-- Run once, only after every admin has filled in their volunteer profile (the site shows a reminder until then).
-- Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- 0012 added the "every admin is a volunteer" rule for new admins only (NOT VALID). This checks the admins that
-- already existed too. If it fails, an admin still has no volunteer profile: the query below lists them.
--
--   select a.user_id from public.admins a left join public.volunteers v on v.id = a.user_id where v.id is null;

alter table public.admins validate constraint admins_volunteer_fk;
