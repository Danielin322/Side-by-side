-- Verification meetings with volunteers.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
--   * Admins schedule, reschedule, cancel or mark a meeting as "didn't happen" (admin-only table).
--   * A volunteer sees only their own upcoming meeting's time and link, through get_my_meeting().
--     The admin's note is never returned to them.
--   * The volunteer's status follows the meeting: scheduled -> 'interview'; cancelled / didn't happen -> 'applied'.
--   * When a volunteer is verified or not approved, an open meeting is closed automatically
--     ('held' if its time has passed, otherwise 'cancelled').

create table public.volunteer_meetings (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  scheduled_at timestamptz not null,
  link         text check (char_length(link) <= 500 and link ~* '^https?://'),
  note         text check (char_length(note) <= 1000),
  outcome      text not null default 'scheduled' check (outcome in ('scheduled', 'held', 'cancelled', 'missed')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- At most one open meeting per volunteer.
create unique index volunteer_meetings_one_open on public.volunteer_meetings (volunteer_id) where outcome = 'scheduled';
create index volunteer_meetings_volunteer_idx on public.volunteer_meetings (volunteer_id, scheduled_at desc);

create trigger volunteer_meetings_touch_updated_at
  before update on public.volunteer_meetings
  for each row execute function public.touch_updated_at();

alter table public.volunteer_meetings enable row level security;
revoke all on public.volunteer_meetings from anon, authenticated;
grant select on public.volunteer_meetings to authenticated;

create policy "Admins read meetings" on public.volunteer_meetings
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------- volunteer: own upcoming meeting
create or replace function public.get_my_meeting()
returns table (scheduled_at timestamptz, link text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.scheduled_at, m.link
  from public.volunteer_meetings m
  where m.volunteer_id = (select auth.uid()) and m.outcome = 'scheduled'
  limit 1;
$$;

-- ---------------------------------------------------------------- admin: schedule / reschedule
create or replace function public.schedule_volunteer_meeting(
  p_volunteer_id uuid,
  p_scheduled_at timestamptz,
  p_link         text,
  p_note         text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_scheduled_at < now() - interval '5 minutes' then
    raise exception 'in_past' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.volunteers where id = p_volunteer_id and status in ('applied', 'interview')) then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  update public.volunteer_meetings
     set scheduled_at = p_scheduled_at, link = nullif(trim(p_link), ''), note = nullif(trim(p_note), '')
   where volunteer_id = p_volunteer_id and outcome = 'scheduled';
  if not found then
    insert into public.volunteer_meetings (volunteer_id, scheduled_at, link, note, created_by)
    values (p_volunteer_id, p_scheduled_at, nullif(trim(p_link), ''), nullif(trim(p_note), ''), (select auth.uid()));
  end if;

  update public.volunteers set status = 'interview' where id = p_volunteer_id and status = 'applied';
end;
$$;

-- ---------------------------------------------------------------- admin: cancel or mark "didn't happen"
create or replace function public.close_volunteer_meeting(p_volunteer_id uuid, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_outcome not in ('cancelled', 'missed') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  update public.volunteer_meetings
     set outcome = p_outcome
   where volunteer_id = p_volunteer_id and outcome = 'scheduled';
  if not found then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  update public.volunteers set status = 'applied' where id = p_volunteer_id and status = 'interview';
end;
$$;

-- ---------------------------------------------------------------- close open meetings when a decision is made
create or replace function public.close_meetings_on_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('approved', 'not_approved') and new.status is distinct from old.status then
    update public.volunteer_meetings
       set outcome = case when scheduled_at <= now() then 'held' else 'cancelled' end
     where volunteer_id = new.id and outcome = 'scheduled';
  end if;
  return new;
end;
$$;

create trigger volunteers_close_meetings_on_decision
  after update of status on public.volunteers
  for each row execute function public.close_meetings_on_decision();

-- ---------------------------------------------------------------- permissions
revoke all on function public.get_my_meeting() from public, anon;
revoke all on function public.schedule_volunteer_meeting(uuid, timestamptz, text, text) from public, anon;
revoke all on function public.close_volunteer_meeting(uuid, text) from public, anon;
revoke all on function public.close_meetings_on_decision() from public, anon, authenticated;
grant execute on function public.get_my_meeting() to authenticated;
grant execute on function public.schedule_volunteer_meeting(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.close_volunteer_meeting(uuid, text) to authenticated;
