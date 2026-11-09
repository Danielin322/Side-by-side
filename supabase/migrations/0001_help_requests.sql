-- Phase 3: help requests from the /ask-for-help form.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Privacy design (PRD §2):
--   * help_requests holds what a volunteer may see BEFORE accepting (first name, city, needs).
--   * help_request_contacts holds last name, phone and email, revealed only after accepting
--     (the volunteer dashboard phase adds those read rules).
--   * Visitors cannot read or change either table. They can only call submit_help_request(),
--     which validates the input and writes both rows together.
--   * There is deliberately no column for ID numbers or uploaded files.

create table public.help_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'open'
                  check (status in ('open', 'matched', 'closed')),
  support_types text[] not null
                  check (cardinality(support_types) between 1 and 7
                     and support_types <@ array['documents','rights','co_typing','scheduling',
                                                 'calls','accompaniment','follow_up']),
  meeting_mode  text not null check (meeting_mode in ('in_person', 'video', 'phone', 'any')),
  city          text check (char_length(city) between 1 and 80),
  language      text not null check (language in ('he', 'ar', 'ru', 'en')),
  note          text check (char_length(note) <= 500),
  first_name    text not null check (char_length(first_name) between 1 and 60),
  locale        text not null check (locale in ('he', 'en')),
  constraint city_needed_in_person check (meeting_mode <> 'in_person' or city is not null)
);

create table public.help_request_contacts (
  request_id  uuid primary key references public.help_requests (id) on delete cascade,
  last_name   text not null check (char_length(last_name) between 1 and 60),
  phone       text not null check (phone ~ '^0[0-9]{8,9}$'),
  email       text check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Lock both tables: RLS on with no policies means no access through the public API.
alter table public.help_requests enable row level security;
alter table public.help_request_contacts enable row level security;
revoke all on public.help_requests, public.help_request_contacts from anon, authenticated;

create or replace function public.submit_help_request(
  p_support_types text[],
  p_meeting_mode  text,
  p_city          text,
  p_language      text,
  p_note          text,
  p_first_name    text,
  p_last_name     text,
  p_phone         text,
  p_email         text,
  p_locale        text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.help_requests
    (support_types, meeting_mode, city, language, note, first_name, locale)
  values
    (p_support_types, p_meeting_mode, nullif(trim(p_city), ''), p_language,
     nullif(trim(p_note), ''), trim(p_first_name), p_locale)
  returning id into new_id;

  insert into public.help_request_contacts (request_id, last_name, phone, email)
  values (new_id, trim(p_last_name), p_phone, nullif(lower(trim(p_email)), ''));
end;
$$;

revoke all on function public.submit_help_request from public;
grant execute on function public.submit_help_request to anon, authenticated;
