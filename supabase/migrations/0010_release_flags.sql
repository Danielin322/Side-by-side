-- Release-note flags: when a volunteer hands a case back with a note, the server classifies the note
-- (src/features/releaseFlag) and, if an admin should look at it, adds an 'auto_flag' issue to Needs attention.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
--   * Flags only add: a flag never hides or changes the note, the case, or a volunteer's own issue report.
--   * The server writes flags with the secret key, after the hand-back has already been saved.
--   * If the check fails (AWS, Anthropic, timeout), a flag is still added (outcome 'failed') so the note gets read.
--   * Admins can mark each flag right or wrong; that feedback is how we measure the flags in real use.
--   * system_logs gets a 'release_flags' category. Log rows hold ids, labels and error details, never note text.

-- ---------------------------------------------------------------- flags on request_issues
alter table public.request_issues drop constraint if exists request_issues_kind_check;
alter table public.request_issues add constraint request_issues_kind_check
  check (kind in ('unreachable', 'professional', 'safety', 'coordinator', 'concern', 'auto_flag'));

alter table public.request_issues
  add column flag_outcome     text check (flag_outcome in ('flagged', 'refused', 'failed')),
  add column flag_reason      text check (char_length(flag_reason) <= 1000),
  add column flag_evidence    text check (char_length(flag_evidence) <= 1000),
  add column flag_model       text check (char_length(flag_model) <= 200),
  -- The labeled example notes Claude was shown: [{id, label, similarity}]. Ids only, no text.
  add column flag_examples    jsonb,
  add column event_id         uuid references public.request_events (id) on delete set null,
  add column flag_feedback    text check (flag_feedback in ('right', 'wrong')),
  add column flag_feedback_at timestamptz,
  add column flag_feedback_by uuid references auth.users (id) on delete set null;

alter table public.request_issues add constraint request_issues_auto_flag_check
  check (kind <> 'auto_flag' or flag_outcome is not null);

-- One flag per hand-back, even if the check runs twice.
create unique index request_issues_flag_event_idx on public.request_issues (event_id) where kind = 'auto_flag';

-- ---------------------------------------------------------------- logs
alter table public.system_logs drop constraint if exists system_logs_category_check;
alter table public.system_logs add constraint system_logs_category_check
  check (category in ('requests', 'volunteers', 'meetings', 'auth', 'system', 'release_flags'));

-- Flags are logged by the app (release_flag.flagged / .refused / .failed, with model details),
-- so the generic "issue reported" entry is skipped for them. Resolving a flag is still logged.
create or replace function public.log_request_issue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'auto_flag' then
      return new;
    end if;
    perform public.write_log('warning', 'requests', 'request.issue_reported',
      format('Issue reported on a case: %s', new.kind),
      jsonb_build_object('request_id', new.request_id, 'issue_id', new.id, 'kind', new.kind),
      new.volunteer_id);
  elsif old.resolved_at is null and new.resolved_at is not null then
    perform public.write_log('info', 'requests', 'request.issue_resolved',
      format('Issue resolved: %s', new.kind),
      jsonb_build_object('request_id', new.request_id, 'issue_id', new.id, 'kind', new.kind),
      new.resolved_by);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- admin feedback on a flag
create or replace function public.admin_flag_feedback(p_issue_id uuid, p_feedback text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issue public.request_issues;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_feedback not in ('right', 'wrong') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  update public.request_issues
     set flag_feedback = p_feedback, flag_feedback_at = now(), flag_feedback_by = (select auth.uid())
   where id = p_issue_id and kind = 'auto_flag'
  returning * into v_issue;
  if not found then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  perform public.write_log('info', 'release_flags', 'release_flag.feedback',
    format('Admin marked a flag as %s', p_feedback),
    jsonb_build_object('request_id', v_issue.request_id, 'issue_id', v_issue.id, 'feedback', p_feedback,
                       'outcome', v_issue.flag_outcome, 'model', v_issue.flag_model));
end;
$$;

revoke all on function public.log_request_issue() from public, anon, authenticated;
revoke all on function public.admin_flag_feedback(uuid, text) from public, anon;
grant execute on function public.admin_flag_feedback(uuid, text) to authenticated;
