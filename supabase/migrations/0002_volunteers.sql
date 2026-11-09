-- Phase 4a: volunteer applications, statuses and admins.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Privacy design:
--   * volunteers: profile and status. A volunteer can read their own row; admins can read and update all rows.
--   * volunteer_sensitive: national ID, date of birth and admin notes. Admins only.
--   * admins: which accounts are admins. Nobody can add themselves through the API.
--   * Applications are created only by the server (secret key) through create_volunteer_application().

-- ---------------------------------------------------------------- admins
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin from public;
grant execute on function public.is_admin to authenticated;

create policy "Users see their own admin row; admins see all"
  on public.admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------- volunteers
create table public.volunteers (
  id                 uuid primary key references auth.users (id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  status             text not null default 'applied'
                       check (status in ('applied', 'interview', 'approved', 'not_approved')),
  full_name          text not null check (char_length(full_name) between 2 and 100),
  email              text not null check (char_length(email) <= 254),
  phone              text not null check (phone ~ '^0[0-9]{8,9}$'),
  city               text not null check (char_length(city) between 1 and 80),
  occupation         text check (char_length(occupation) <= 120),
  availability       text[] not null check (cardinality(availability) between 1 and 21),
  commit_six_months  boolean not null,
  transport          text[] not null default '{}'
                       check (transport <@ array['license', 'car', 'public_transit']),
  languages          jsonb not null check (jsonb_typeof(languages) = 'array' and jsonb_array_length(languages) >= 1),
  support_types      text[] not null
                       check (cardinality(support_types) >= 1
                          and support_types <@ array['documents','rights','co_typing','scheduling',
                                                      'calls','accompaniment','follow_up']),
  meeting_modes      text[] not null
                       check (cardinality(meeting_modes) >= 1
                          and meeting_modes <@ array['in_person', 'video', 'phone']),
  experience         text check (char_length(experience) <= 1000),
  motivation         text not null check (char_length(motivation) between 20 and 1000),
  skills             text check (char_length(skills) <= 500),
  background_consent boolean not null check (background_consent),
  conduct_agreed     boolean not null check (conduct_agreed),
  locale             text not null check (locale in ('he', 'en'))
);

create table public.volunteer_sensitive (
  volunteer_id uuid primary key references public.volunteers (id) on delete cascade,
  national_id  text not null check (national_id ~ '^[0-9]{9}$'),
  birth_date   date not null check (birth_date > date '1900-01-01'),
  admin_notes  text check (char_length(admin_notes) <= 4000)
);

alter table public.volunteers enable row level security;
alter table public.volunteer_sensitive enable row level security;

revoke all on public.admins, public.volunteers, public.volunteer_sensitive from anon, authenticated;
grant select on public.admins to authenticated;
grant select, update on public.volunteers to authenticated;
grant select, update on public.volunteer_sensitive to authenticated;

create policy "Volunteers read their own row; admins read all"
  on public.volunteers for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins update volunteers"
  on public.volunteers for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins read sensitive data"
  on public.volunteer_sensitive for select to authenticated
  using ((select public.is_admin()));

create policy "Admins update sensitive data"
  on public.volunteer_sensitive for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger volunteers_touch_updated_at
  before update on public.volunteers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- application (server only)
create or replace function public.create_volunteer_application(
  p_user_id            uuid,
  p_full_name          text,
  p_email              text,
  p_phone              text,
  p_city               text,
  p_occupation         text,
  p_availability       text[],
  p_commit_six_months  boolean,
  p_transport          text[],
  p_languages          jsonb,
  p_support_types      text[],
  p_meeting_modes      text[],
  p_experience         text,
  p_motivation         text,
  p_skills             text,
  p_national_id        text,
  p_birth_date         date,
  p_locale             text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_birth_date > current_date - interval '18 years' then
    raise exception 'Volunteers must be at least 18' using errcode = '22023';
  end if;

  insert into public.volunteers
    (id, full_name, email, phone, city, occupation, availability, commit_six_months, transport,
     languages, support_types, meeting_modes, experience, motivation, skills,
     background_consent, conduct_agreed, locale)
  values
    (p_user_id, trim(p_full_name), lower(trim(p_email)), p_phone, trim(p_city),
     nullif(trim(p_occupation), ''), p_availability, p_commit_six_months, p_transport,
     p_languages, p_support_types, p_meeting_modes, nullif(trim(p_experience), ''),
     trim(p_motivation), nullif(trim(p_skills), ''), true, true, p_locale);

  insert into public.volunteer_sensitive (volunteer_id, national_id, birth_date)
  values (p_user_id, p_national_id, p_birth_date);
end;
$$;

-- Only the server's secret key (service_role) may create applications.
revoke all on function public.create_volunteer_application from public, anon, authenticated;
grant execute on function public.create_volunteer_application to service_role;
