-- Best match agent: track when a help request last changed.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- The volunteer dashboard caches the agent's picks; each open request's updated_at is part of the cache key,
-- so editing a request (status, checklist, assignment, ...) invalidates the cached picks automatically.

alter table public.help_requests
  add column if not exists updated_at timestamptz not null default now();

update public.help_requests set updated_at = coalesce(assigned_at, created_at) where updated_at > created_at;

drop trigger if exists help_requests_touch_updated_at on public.help_requests;
create trigger help_requests_touch_updated_at
  before update on public.help_requests
  for each row execute function public.touch_updated_at();

-- The return type changes, so the function has to be dropped and recreated (create or replace can't do it).
drop function if exists public.list_open_requests();

create function public.list_open_requests()
returns table (
  id uuid, created_at timestamptz, updated_at timestamptz, support_types text[], meeting_mode text,
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
    select r.id, r.created_at, r.updated_at, r.support_types, r.meeting_mode,
           case when r.meeting_mode = 'in_person' then r.city end,
           r.language, r.first_name
    from public.help_requests r
    where r.status = 'open'
    order by r.created_at;
end;
$$;

revoke all on function public.list_open_requests() from public, anon;
grant execute on function public.list_open_requests() to authenticated;
