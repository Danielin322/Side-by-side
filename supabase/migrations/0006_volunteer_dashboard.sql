-- Volunteer dashboard: activity history and profile editing.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
--   * list_my_history(): requests the signed-in volunteer completed or handed back, newest first.
--     Only the first name and type of help are returned: contact details stay hidden once a request is done.
--   * update_my_volunteer_profile(): the volunteer edits the practical parts of their own profile.
--     Name, email, ID, birth date, agreements and status stay admin-only.

-- ---------------------------------------------------------------- history
create or replace function public.list_my_history()
returns table (
  event_id      uuid,
  kind          text,
  request_id    uuid,
  first_name    text,
  support_types text[],
  meeting_mode  text,
  accepted_at   timestamptz,
  ended_at      timestamptz,
  summary       text,
  reason        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id,
         e.kind,
         r.id,
         r.first_name,
         r.support_types,
         r.meeting_mode,
         -- When this volunteer last accepted the request before this event.
         (select max(a.created_at)
            from public.request_events a
           where a.request_id = e.request_id
             and a.actor = e.actor
             and a.kind = 'accepted'
             and a.created_at <= e.created_at),
         e.created_at,
         case when e.kind = 'completed' then r.summary end,
         e.reason
    from public.request_events e
    join public.help_requests r on r.id = e.request_id
   where e.actor = (select auth.uid())
     and e.kind in ('completed', 'released')
   order by e.created_at desc
   limit 200;
$$;

revoke all on function public.list_my_history from public, anon;
grant execute on function public.list_my_history to authenticated;

-- ---------------------------------------------------------------- profile
create or replace function public.update_my_volunteer_profile(
  p_phone         text,
  p_city          text,
  p_occupation    text,
  p_availability  text[],
  p_transport     text[],
  p_languages     jsonb,
  p_support_types text[],
  p_meeting_modes text[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Each language must be a known code with a known level (the table only checks it is a non-empty array).
  if jsonb_typeof(p_languages) <> 'array'
     or jsonb_array_length(p_languages) < 1
     or exists (
       select 1 from jsonb_array_elements(p_languages) l
        where jsonb_typeof(l) <> 'object'
           or not (l->>'code' = any (array['he', 'ar', 'ru', 'en', 'am', 'fr', 'es']))
           or not (l->>'level' = any (array['basic', 'good', 'native']))
     ) then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  -- The table's CHECK constraints validate phone, city, availability, transport, support types and meeting modes.
  update public.volunteers
     set phone         = p_phone,
         city          = trim(p_city),
         occupation    = nullif(trim(p_occupation), ''),
         availability  = p_availability,
         transport     = coalesce(p_transport, '{}'),
         languages     = p_languages,
         support_types = p_support_types,
         meeting_modes = p_meeting_modes
   where id = (select auth.uid());

  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.update_my_volunteer_profile from public, anon;
grant execute on function public.update_my_volunteer_profile to authenticated;
