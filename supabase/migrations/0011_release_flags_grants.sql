-- Release-note flags: let the server (secret key) read the hand-back and save the flag.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run (after 0010_release_flags.sql).
--
-- In this project the secret key (service_role) only gets the table rights granted to it explicitly
-- (see 0008 for system_logs). The background check in src/features/releaseFlag/classify.ts needs:
--   * request_events: read the note of the hand-back that was just saved;
--   * request_issues: add the auto_flag issue and read back its id.

grant select on public.request_events to service_role;
grant select, insert on public.request_issues to service_role;
