-- Admin roles: every admin is also a volunteer; admins can make approved volunteers admins; the root admin
-- can remove admins that were added.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
--   * Admins that exist today become root admins. Root admins can't be removed through the site.
--   * An account can only be an admin if it has a volunteer profile (foreign key below). It is added
--     NOT VALID, so today's admins without a profile keep working until they fill it in on /volunteer;
--     every admin added from now on must already be a volunteer. After every admin has a profile, run
--     0013_validate_admin_volunteers.sql.
--   * Any admin can make an approved volunteer an admin. Only a root admin can remove an admin.

-- ---------------------------------------------------------------- columns
alter table public.admins
  add column is_root  boolean not null default false,
  add column added_by uuid references auth.users (id) on delete set null;

update public.admins set is_root = true;

alter table public.admins
  add constraint admins_volunteer_fk foreign key (user_id) references public.volunteers (id) on delete cascade not valid;

-- ---------------------------------------------------------------- helpers
create or replace function public.is_root_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()) and is_root);
$$;

-- ---------------------------------------------------------------- add / remove admins
create or replace function public.add_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select email into v_email from public.volunteers where id = p_user_id and status = 'approved';
  if v_email is null then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  insert into public.admins (user_id, added_by) values (p_user_id, (select auth.uid()))
  on conflict (user_id) do nothing;
  if found then
    perform public.write_log('info', 'volunteers', 'volunteer.admin_added',
      format('Volunteer %s made an admin', v_email),
      jsonb_build_object('volunteer_id', p_user_id, 'volunteer_email', v_email));
  end if;
end;
$$;

create or replace function public.remove_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not public.is_root_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  delete from public.admins where user_id = p_user_id and not is_root;
  if not found then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  select email into v_email from public.volunteers where id = p_user_id;
  perform public.write_log('info', 'volunteers', 'volunteer.admin_removed',
    format('Admin rights removed from %s', coalesce(v_email, p_user_id::text)),
    jsonb_build_object('volunteer_id', p_user_id, 'volunteer_email', v_email));
end;
$$;

-- ---------------------------------------------------------------- an admin fills in their volunteer profile (server only)
-- Same fields as the volunteer application, for the admin's own account; the profile is approved at once.
create or replace function public.create_admin_volunteer_profile(
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
  if not exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.volunteers where id = p_user_id) then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  perform public.create_volunteer_application(
    p_user_id, p_full_name, p_email, p_phone, p_city, p_occupation, p_availability, p_commit_six_months,
    p_transport, p_languages, p_support_types, p_meeting_modes, p_experience, p_motivation, p_skills,
    p_national_id, p_birth_date, p_locale);
  update public.volunteers set status = 'approved' where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------- permissions
revoke all on function public.is_root_admin() from public, anon;
grant execute on function public.is_root_admin() to authenticated;
revoke all on function public.add_admin(uuid) from public, anon;
grant execute on function public.add_admin(uuid) to authenticated;
revoke all on function public.remove_admin(uuid) from public, anon;
grant execute on function public.remove_admin(uuid) to authenticated;
revoke all on function public.create_admin_volunteer_profile(uuid, text, text, text, text, text, text[], boolean, text[], jsonb, text[], text[], text, text, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.create_admin_volunteer_profile(uuid, text, text, text, text, text, text[], boolean, text[], jsonb, text[], text[], text, text, text, text, date, text)
  to service_role;
