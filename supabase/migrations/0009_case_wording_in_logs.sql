-- Wording: help requests are called "cases" in the UI.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Only the English text stored in system_logs.message changes (shown under each entry and in the CSV export).
-- Event codes ('request.accepted', ...), the 'requests' category, and table and function names stay the same.

create or replace function public.log_help_request_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_log('info', 'requests', 'request.created', 'New case submitted',
    jsonb_build_object('request_id', new.id, 'meeting_mode', new.meeting_mode, 'language', new.language));
  return new;
end;
$$;

create or replace function public.log_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_log('info', 'requests', 'request.' || new.kind,
    case new.kind when 'accepted' then 'Case accepted'
                  when 'released' then 'Case handed back'
                  when 'completed' then 'Case completed'
                  when 'admin_released' then 'Case returned to the open list'
                  when 'admin_closed' then 'Case closed by the team'
                  else format('Case %s', replace(new.kind, '_', ' ')) end,
    jsonb_strip_nulls(jsonb_build_object('request_id', new.request_id, 'reason', new.reason)),
    new.actor);
  return new;
end;
$$;

create or replace function public.log_request_issue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_log('warning', 'requests', 'request.issue_reported',
      format('Issue reported on a case: %s', new.kind),
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

-- Same wording for entries already in the log.
update public.system_logs set message = case event
    when 'request.created' then 'New case submitted'
    when 'request.accepted' then 'Case accepted'
    when 'request.released' then 'Case handed back'
    when 'request.completed' then 'Case completed'
    when 'request.admin_released' then 'Case returned to the open list'
    when 'request.admin_closed' then 'Case closed by the team'
  end
 where event in ('request.created', 'request.accepted', 'request.released', 'request.completed',
                 'request.admin_released', 'request.admin_closed');

update public.system_logs
   set message = replace(message, 'Issue reported on a request:', 'Issue reported on a case:')
 where event = 'request.issue_reported';

revoke all on function public.log_help_request_created() from public, anon, authenticated;
revoke all on function public.log_request_event() from public, anon, authenticated;
revoke all on function public.log_request_issue() from public, anon, authenticated;
