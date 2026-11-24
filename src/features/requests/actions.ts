"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { errorMeta, logError } from "@/lib/logs";
import { flagReleasedNote } from "@/features/releaseFlag/classify";
import {
  ISSUE_KINDS,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_TEXT,
  RELEASE_REASONS,
  type ChecklistItem,
  type IssueKind,
  type ReleaseReason,
  type RequestActionResult,
} from "./model";

const KNOWN_ERRORS = ["not_approved", "not_yours", "not_open", "limit_reached", "forbidden", "invalid"] as const;
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** Calls a database function as the signed-in user and maps its errors to known keys. */
async function call(fn: string, args: Record<string, unknown>): Promise<RequestActionResult> {
  const supabase = await createSessionClient();
  const { error } = await supabase.rpc(fn, args);
  revalidatePath("/[locale]/volunteer/dashboard", "page");
  revalidatePath("/[locale]/admin", "layout");
  if (!error) return { ok: true };
  const known = KNOWN_ERRORS.find((k) => error.message === k);
  if (!known) await logError("requests", "system.rpc_failed", `[requests] ${fn} failed`, { fn, ...errorMeta(error) });
  return { ok: false, error: known ?? "failed" };
}

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function acceptRequest(id: string) {
  if (!isUuid(id)) return { ok: false, error: "invalid" } as const;
  return call("accept_request", { p_id: id });
}

/** Saves the volunteer's own checklist for a request they hold (the whole list, in order). */
export async function saveChecklist(id: string, items: ChecklistItem[]) {
  if (!isUuid(id) || !Array.isArray(items) || items.length > MAX_CHECKLIST_ITEMS) return { ok: false, error: "invalid" } as const;
  const clean = items.map((i) => ({ id: String(i?.id ?? "").slice(0, 64), text: text(i?.text, MAX_CHECKLIST_TEXT), done: i?.done === true }));
  if (clean.some((i) => !i.id || !i.text)) return { ok: false, error: "invalid" } as const;
  return call("save_request_checklist", { p_id: id, p_items: clean });
}

/** Saves the date of the next meeting. The old built-in checklist column is no longer used, so it's left empty. */
export async function saveNextMeeting(id: string, nextMeeting: string | null) {
  if (!isUuid(id)) return { ok: false, error: "invalid" } as const;
  if (nextMeeting && !/^\d{4}-\d{2}-\d{2}$/.test(nextMeeting)) return { ok: false, error: "invalid" } as const;
  return call("save_request_progress", { p_id: id, p_checklist: [], p_next_meeting: nextMeeting || null });
}

export async function reportIssue(id: string, kind: IssueKind, note: string) {
  if (!isUuid(id) || !ISSUE_KINDS.includes(kind)) return { ok: false, error: "invalid" } as const;
  return call("report_request_issue", { p_id: id, p_kind: kind, p_note: text(note, 1000) });
}

export async function releaseRequest(id: string, reason: ReleaseReason, note: string) {
  if (!isUuid(id) || !RELEASE_REASONS.includes(reason)) return { ok: false, error: "invalid" } as const;
  const result = await call("release_request", { p_id: id, p_reason: reason, p_note: text(note, 1000) });
  // Check the note for an admin after the response is sent, so the volunteer doesn't wait (src/features/releaseFlag).
  if (result.ok && text(note, 1000)) after(() => flagReleasedNote(id));
  return result;
}

export async function completeRequest(id: string, summary: string, concern: string) {
  if (!isUuid(id)) return { ok: false, error: "invalid" } as const;
  return call("complete_request", { p_id: id, p_summary: text(summary, 1000), p_concern: text(concern, 1000) });
}

export async function adminReleaseRequest(id: string, note: string) {
  if (!isUuid(id)) return { ok: false, error: "invalid" } as const;
  return call("admin_release_request", { p_id: id, p_note: text(note, 1000) });
}

export async function adminCloseRequest(id: string, note: string) {
  if (!isUuid(id)) return { ok: false, error: "invalid" } as const;
  return call("admin_close_request", { p_id: id, p_note: text(note, 1000) });
}

/** Admin feedback on an automatic note flag: was it right? */
export async function flagFeedback(issueId: string, feedback: "right" | "wrong") {
  if (!isUuid(issueId) || (feedback !== "right" && feedback !== "wrong")) return { ok: false, error: "invalid" } as const;
  return call("admin_flag_feedback", { p_issue_id: issueId, p_feedback: feedback });
}

export async function resolveIssue(issueId: string) {
  if (!isUuid(issueId)) return { ok: false, error: "invalid" } as const;
  return call("resolve_request_issue", { p_issue_id: issueId });
}
