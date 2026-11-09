-- Phase 4b: volunteers accept and work on help requests; admins manage them.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Access design:
--   * Volunteers never read the request tables directly. They call the functions below, which check that
--     the caller is an approved volunteer and, where relevant, that they hold the request.
--   * Before accepting, volunteers see a preview without the note or contact details (list_open_requests).
--   * Contact details and the note are returned only to the assigned volunteer (list_my_requests) and admins.
--   * Admins read the tables directly through RLS policies and act through admin_* functions.

-- ---------------------------------------------------------------- help_requests: new statuses and work fields
alter table public.help_requests drop constraint if exists help_requests_status_check;
update public.help_requests set status = 'in_progress' where status = 'matched';
alter table public.help_requests
  add constraint help_requests_status_check
    check (status in ('open', 'in_progress', 'completed', 'closed')),
  add column assigned_to  uuid references public.volunteers (id) on delete set null,
  add column assigned_at  timestamptz,
  add column checklist    text[] not null default '{}'
                            check (cardinality(checklist) <= 40),
  add column next_meeting date,
  add column completed_at timestamptz,
  add column summary      text check (char_length(summary) <= 1000);

create index if not exists help_requests_status_idx on public.help_requests (status);
create index if not exists help_requests_assigned_idx on public.help_requests (assigned_to);

-- ---------------------------------------------------------------- issues and history
create table public.request_issues (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.help_requests (id) on delete cascade,
  volunteer_id uuid references public.volunteers (id) on delete set null,
  kind         text not null check (kind in ('unreachable', 'professional', 'safety', 'coordinator', 'concern')),
  note         text check (char_length(note) <= 1000),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users (id) on delete set null
);
create index request_issues_open_idx on public.request_issues (resolved_at) where resolved_at is null;

create table public.request_events (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.help_requests (id) on delete cascade,
  actor      uuid references auth.users (id) on delete set null,
  kind       text not null check (kind in ('accepted', 'released', 'completed', 'admin_released', 'admin_closed')),
  reason     text check (reason in ('availability', 'not_fit', 'asked_other', 'other')),
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index request_events_request_idx on public.request_events (request_id, created_at);

alter table public.request_issues enable row level security;
alter table public.request_events enable row level security;
revoke all on public.request_issues, public.request_events from anon, authenticated;

-- ---------------------------------------------------------------- admin read access (RLS)
grant select on public.help_requests, public.help_request_contacts,
                public.request_issues, public.request_events to authenticated;

create policy "Admins read help requests" on public.help_requests
  for select to authenticated using ((select public.is_admin()));
create policy "Admins read request contacts" on public.help_request_contacts
  for select to authenticated using ((select public.is_admin()));
create policy "Admins read request issues" on public.request_issues
  for select to authenticated using ((select public.is_admin()));
create policy "Admins read request events" on public.request_events
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------- helpers
create or replace function public.is_approved_volunteer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteers where id = (select auth.uid()) and status = 'approved'
  );
$$;

-- Raises unless the caller is an approved volunteer holding this in-progress request.
create or replace function public.assert_holds_request(p_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_approved_volunteer() then
    raise exception 'not_approved' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.help_requests
    where id = p_id and assigned_to = (select auth.uid()) and status = 'in_progress'
  ) then
    raise exception 'not_yours' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------- volunteer functions
create or replace function public.list_open_requests()
returns table (
  id uuid, created_at timestamptz, support_types text[], meeting_mode text,
  city text, language text, first_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_approved_volunteer() then
    raise exception 'not_approved' using errcode = 'P0001';
  end if;
  return query
    select r.id, r.created_at, r.support_types, r.meeting_mode,
           case when r.meeting_mode = 'in_person' then r.city end,
           r.language, r.first_name
    from public.help_requests r
    where r.status = 'open'
    order by r.created_at;
end;
$$;

create or replace function public.list_my_requests()
returns table (
  id uuid, created_at timestamptz, support_types text[], meeting_mode text, city text,
  language text, first_name text, last_name text, phone text, email text, note text,
  checklist text[], next_meeting date, assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_approved_volunteer() then
    raise exception 'not_approved' using errcode = 'P0001';
  end if;
  return query
    select r.id, r.created_at, r.support_types, r.meeting_mode, r.city, r.language, r.first_name,
           c.last_name, c.phone, c.email, r.note, r.checklist, r.next_meeting, r.assigned_at
    from public.help_requests r
    join public.help_request_contacts c on c.request_id = r.id
    where r.assigned_to = (select auth.uid()) and r.status = 'in_progress'
    order by r.assigned_at;
end;
$$;

create or replace function public.accept_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  active int;
begin
  if not public.is_approved_volunteer() then
    raise exception 'not_approved' using errcode = 'P0001';
  end if;
  -- Serialize this volunteer's accepts so two quick clicks can't exceed the limit.
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select count(*) into active from public.help_requests where assigned_to = uid and status = 'in_progress';
  if active >= 3 then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;
  -- "status = 'open'" makes the first accept win; a second one updates nothing.
  update public.help_requests
     set status = 'in_progress', assigned_to = uid, assigned_at = now(), checklist = '{}', next_meeting = null
   where id = p_id and status = 'open';
  if not found then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  insert into public.request_events (request_id, actor, kind) values (p_id, uid, 'accepted');
end;
$$;

create or replace function public.save_request_progress(p_id uuid, p_checklist text[], p_next_meeting date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_holds_request(p_id);
  if exists (select 1 from unnest(coalesce(p_checklist, '{}')) as item where item !~ '^[a-z_]{1,30}\.[a-z_]{1,30}$') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  update public.help_requests
     set checklist = coalesce(p_checklist, '{}'), next_meeting = p_next_meeting
   where id = p_id;
end;
$$;

create or replace function public.report_request_issue(p_id uuid, p_kind text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_holds_request(p_id);
  if p_kind not in ('unreachable', 'professional', 'safety', 'coordinator') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  insert into public.request_issues (request_id, volunteer_id, kind, note)
  values (p_id, (select auth.uid()), p_kind, nullif(trim(p_note), ''));
end;
$$;

create or replace function public.release_request(p_id uuid, p_reason text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_holds_request(p_id);
  if p_reason not in ('availability', 'not_fit', 'asked_other', 'other') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  update public.help_requests
     set status = 'open', assigned_to = null, assigned_at = null, checklist = '{}', next_meeting = null
   where id = p_id;
  insert into public.request_events (request_id, actor, kind, reason, note)
  values (p_id, (select auth.uid()), 'released', p_reason, nullif(trim(p_note), ''));
end;
$$;

create or replace function public.complete_request(p_id uuid, p_summary text, p_concern text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_holds_request(p_id);
  update public.help_requests
     set status = 'completed', completed_at = now(), summary = nullif(trim(p_summary), '')
   where id = p_id;
  insert into public.request_events (request_id, actor, kind) values (p_id, (select auth.uid()), 'completed');
  if nullif(trim(p_concern), '') is not null then
    insert into public.request_issues (request_id, volunteer_id, kind, note)
    values (p_id, (select auth.uid()), 'concern', trim(p_concern));
  end if;
end;
$$;

-- ---------------------------------------------------------------- admin functions
create or replace function public.admin_release_request(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.help_requests
     set status = 'open', assigned_to = null, assigned_at = null, checklist = '{}', next_meeting = null
   where id = p_id and status in ('in_progress', 'completed', 'closed');
  if not found then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  insert into public.request_events (request_id, actor, kind, note)
  values (p_id, (select auth.uid()), 'admin_released', nullif(trim(p_note), ''));
end;
$$;

create or replace function public.admin_close_request(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.help_requests set status = 'closed' where id = p_id and status <> 'closed';
  if not found then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  insert into public.request_events (request_id, actor, kind, note)
  values (p_id, (select auth.uid()), 'admin_closed', nullif(trim(p_note), ''));
end;
$$;

create or replace function public.resolve_request_issue(p_issue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.request_issues
     set resolved_at = now(), resolved_by = (select auth.uid())
   where id = p_issue_id and resolved_at is null;
end;
$$;

-- ---------------------------------------------------------------- permissions
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_approved_volunteer()', 'assert_holds_request(uuid)',
    'list_open_requests()', 'list_my_requests()', 'accept_request(uuid)',
    'save_request_progress(uuid, text[], date)', 'report_request_issue(uuid, text, text)',
    'release_request(uuid, text, text)', 'complete_request(uuid, text, text)',
    'admin_release_request(uuid, text)', 'admin_close_request(uuid, text)', 'resolve_request_issue(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
