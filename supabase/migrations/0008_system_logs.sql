-- System logs: one append-only table for business events and errors/warnings, shown on /admin/logs.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
--   * Business events (sign-ups, approvals, requests, meetings) are written by the triggers below,
--     so every path that changes those tables is covered without touching the existing functions.
--   * Errors and warnings (failed logins, failed emails, server errors) are written by the app
--     with the secret key (src/lib/logs.ts), because many of them come from signed-out visitors.
--   * Only admins can read the table. Nobody can update or delete rows through the API.
--   * Rows hold IDs, statuses and error codes only: no medical details or free-text notes (PRD §2).
--   * Retention: 'info' rows are purged after 6 months; warnings and errors are kept.

create table public.system_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  severity    text not null check (severity in ('info', 'warning', 'error')),
  category    text not null check (category in ('requests', 'volunteers', 'meetings', 'auth', 'system')),
  event       text not null check (char_length(event) <= 80),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_label text check (char_length(actor_label) <= 254),
  message     text not null check (char_length(message) <= 2000),
  metadata    jsonb not null default '{}'::jsonb
);

create index system_logs_created_idx  on public.system_logs (created_at desc);
create index system_logs_severity_idx on public.system_logs (severity, created_at desc);
create index system_logs_category_idx on public.system_logs (category, created_at desc);
create index system_logs_actor_idx    on public.system_logs (actor_label, created_at desc);

alter table public.system_logs enable row level security;
revoke all on public.system_logs from anon, authenticated;
grant select on public.system_logs to authenticated;
grant select, insert on public.system_logs to service_role;

create policy "Admins read system logs" on public.system_logs
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------- helper used by the triggers
-- Actor: the given id, else the signed-in user. Label: the given label, else that user's email, else 'system'.
create or replace function public.write_log(
  p_severity    text,
  p_category    text,
  p_event       text,
  p_message     text,
  p_metadata    jsonb default '{}'::jsonb,
  p_actor_id    uuid default null,
  p_actor_label text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(p_actor_id, (select auth.uid()));
  v_label text := p_actor_label;
begin
  if v_label is null and v_actor is not null then
    select u.email into v_label from auth.users u where u.id = v_actor;
  end if;
  insert into public.system_logs (severity, category, event, actor_id, actor_label, message, metadata)
  values (p_severity, p_category, p_event, v_actor, coalesce(v_label, 'system'), left(p_message, 2000),
          coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------- volunteers
create or replace function public.log_volunteer_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Sign-up runs with the secret key, so there is no signed-in user: record the volunteer themself.
    if (select auth.uid()) is null then
      perform public.write_log('info', 'volunteers', 'volunteer.signed_up',
        'New volunteer application', jsonb_build_object('volunteer_id', new.id), new.id, new.email);
    else
      perform public.write_log('info', 'volunteers', 'volunteer.signed_up',
        'New volunteer application', jsonb_build_object('volunteer_id', new.id));
    end if;
  elsif new.status is distinct from old.status then
    perform public.write_log('info', 'volunteers',
      case new.status when 'approved' then 'volunteer.approved'
                      when 'not_approved' then 'volunteer.not_approved'
                      else 'volunteer.status_changed' end,
      format('Volunteer %s: status %s -> %s', new.email, old.status, new.status),
      jsonb_build_object('volunteer_id', new.id, 'volunteer_email', new.email, 'from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger volunteers_log_insert after insert on public.volunteers
  for each row execute function public.log_volunteer_change();
create trigger volunteers_log_status after update of status on public.volunteers
  for each row execute function public.log_volunteer_change();

-- ---------------------------------------------------------------- help requests
create or replace function public.log_help_request_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_log('info', 'requests', 'request.created', 'New help request submitted',
    jsonb_build_object('request_id', new.id, 'meeting_mode', new.meeting_mode, 'language', new.language));
  return new;
end;
$$;

create trigger help_requests_log_insert after insert on public.help_requests
  for each row execute function public.log_help_request_created();

-- Mirrors the per-request history (accepted, released, completed, admin_released, admin_closed).
create or replace function public.log_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_log('info', 'requests', 'request.' || new.kind,
    format('Request %s', replace(new.kind, '_', ' ')),
    jsonb_strip_nulls(jsonb_build_object('request_id', new.request_id, 'reason', new.reason)),
    new.actor);
  return new;
end;
$$;

create trigger request_events_log_insert after insert on public.request_events
  for each row execute function public.log_request_event();

create or replace function public.log_request_issue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_log('warning', 'requests', 'request.issue_reported',
      format('Issue reported on a request: %s', new.kind),
      jsonb_build_object('request_id', new.request_id, 'issue_id', new.id, 'kind', new.kind),
      new.volunteer_id);
  elsif old.resolved_at is null and new.resolved_at is not null then
    perform public.write_log('info', 'requests', 'request.issue_resolved',
      format('Issue resolved: %s', new.kind),
      jsonb_build_object('request_id', new.request_id, 'issue_id', new.id, 'kind', new.kind),
      new.resolved_by);
  end if;
  return new;
end;
$$;

create trigger request_issues_log_insert after insert on public.request_issues
  for each row execute function public.log_request_issue();
create trigger request_issues_log_resolve after update of resolved_at on public.request_issues
  for each row execute function public.log_request_issue();

-- ---------------------------------------------------------------- meetings
create or replace function public.log_meeting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := jsonb_build_object('meeting_id', new.id, 'volunteer_id', new.volunteer_id,
                                     'scheduled_at', new.scheduled_at);
begin
  if tg_op = 'INSERT' then
    perform public.write_log('info', 'meetings', 'meeting.scheduled', 'Verification meeting scheduled', v_meta);
  elsif new.outcome is distinct from old.outcome then
    perform public.write_log('info', 'meetings', 'meeting.' || new.outcome,
      format('Verification meeting %s', new.outcome), v_meta || jsonb_build_object('from', old.outcome));
  elsif new.scheduled_at is distinct from old.scheduled_at then
    perform public.write_log('info', 'meetings', 'meeting.rescheduled', 'Verification meeting rescheduled',
      v_meta || jsonb_build_object('previous_at', old.scheduled_at));
  end if;
  return new;
end;
$$;

create trigger volunteer_meetings_log after insert or update on public.volunteer_meetings
  for each row execute function public.log_meeting_change();

-- ---------------------------------------------------------------- backfill existing request history
insert into public.system_logs (created_at, severity, category, event, actor_id, actor_label, message, metadata)
select e.created_at, 'info', 'requests', 'request.' || e.kind, e.actor, coalesce(u.email, 'system'),
       format('Request %s', replace(e.kind, '_', ' ')),
       jsonb_strip_nulls(jsonb_build_object('request_id', e.request_id, 'reason', e.reason))
from public.request_events e
left join auth.users u on u.id = e.actor;

-- ---------------------------------------------------------------- retention
create or replace function public.purge_old_logs()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.system_logs
     where severity = 'info' and created_at < now() - interval '6 months'
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- Daily at 03:00 UTC, if pg_cron is enabled. Otherwise: Dashboard -> Database -> Extensions -> pg_cron,
-- then run just this block again.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-old-logs', '0 3 * * *', 'select public.purge_old_logs()');
  else
    raise notice 'pg_cron is not enabled: old info logs will not be purged automatically. Enable it and re-run this block.';
  end if;
end;
$$;

-- ---------------------------------------------------------------- permissions
revoke all on function public.write_log(text, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.log_volunteer_change() from public, anon, authenticated;
revoke all on function public.log_help_request_created() from public, anon, authenticated;
revoke all on function public.log_request_event() from public, anon, authenticated;
revoke all on function public.log_request_issue() from public, anon, authenticated;
revoke all on function public.log_meeting_change() from public, anon, authenticated;
revoke all on function public.purge_old_logs() from public, anon, authenticated;
