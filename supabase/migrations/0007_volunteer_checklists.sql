-- Volunteer-written checklists: the volunteer adds their own steps instead of a built-in list per support type.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
--   * help_requests.checklist_items: [{ "id": "...", "text": "...", "done": true|false }], at most 40 items.
--     The old help_requests.checklist (text[] of built-in keys) is no longer used by the app.
--   * The checklist clears whenever the request changes hands (accepted, handed back, released by an admin).
--   * save_request_checklist(): the volunteer holding the request saves the whole list.
--   * list_my_requests() returns checklist_items instead of checklist.

-- ---------------------------------------------------------------- column
alter table public.help_requests
  add column if not exists checklist_items jsonb not null default '[]'
    check (jsonb_typeof(checklist_items) = 'array' and jsonb_array_length(checklist_items) <= 40);

-- ---------------------------------------------------------------- reset on hand-over
create or replace function public.reset_checklist_on_handover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_to is distinct from old.assigned_to then
    new.checklist_items := '[]'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists help_requests_reset_checklist on public.help_requests;
create trigger help_requests_reset_checklist
  before update of assigned_to on public.help_requests
  for each row execute function public.reset_checklist_on_handover();

-- ---------------------------------------------------------------- save
create or replace function public.save_request_checklist(p_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_holds_request(p_id);
  -- Each item: a short id, 1-200 characters of text, and a done flag. Nothing else.
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 40
     or exists (
       select 1 from jsonb_array_elements(p_items) i
        where jsonb_typeof(i) <> 'object'
           or jsonb_typeof(i->'id') <> 'string' or char_length(i->>'id') not between 1 and 64
           or jsonb_typeof(i->'text') <> 'string' or char_length(btrim(i->>'text')) not between 1 and 200
           or jsonb_typeof(i->'done') <> 'boolean'
           or (select count(*) from jsonb_object_keys(i)) <> 3
     ) then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  update public.help_requests set checklist_items = p_items where id = p_id;
end;
$$;

revoke all on function public.save_request_checklist from public, anon;
grant execute on function public.save_request_checklist to authenticated;

-- ---------------------------------------------------------------- list_my_requests
-- The return type changes, so the function has to be dropped and recreated.
drop function if exists public.list_my_requests();

create function public.list_my_requests()
returns table (
  id uuid, created_at timestamptz, support_types text[], meeting_mode text, city text,
  language text, first_name text, last_name text, phone text, email text, note text,
  checklist_items jsonb, next_meeting date, assigned_at timestamptz
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
           c.last_name, c.phone, c.email, r.note, r.checklist_items, r.next_meeting, r.assigned_at
    from public.help_requests r
    join public.help_request_contacts c on c.request_id = r.id
    where r.assigned_to = (select auth.uid()) and r.status = 'in_progress'
    order by r.assigned_at;
end;
$$;

revoke all on function public.list_my_requests from public, anon;
grant execute on function public.list_my_requests to authenticated;
