"use server";

import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";
import {
  CHECKLISTS,
  ISSUE_KINDS,
  RELEASE_REASONS,
  type IssueKind,
  type ReleaseReason,
  type RequestActionResult,
} from "./model";

const KNOWN_ERRORS = ["not_approved", "not_yours", "not_open", "limit_reached", "forbidden", "invalid"] as const;
const VALID_ITEMS = new Set(Object.entries(CHECKLISTS).flatMap(([type, items]) => items.map((i) => `${type}.${i}`)));
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** Calls a database function as the signed-in user and maps its errors to known keys. */
async function call(fn: string, args: Record<string, unknown>): Promise<RequestActionResult> {
  const supabase = await createSessionClient();
  const { error } = await supabase.rpc(fn, args);
  revalidatePath("/[locale]/volunteer/dashboard", "page");
  revalidatePath("/[locale]/admin", "layout");
  if (!error) return { ok: true };
  const known = KNOWN_ERRORS.find((k) => error.message === k);
  if (!known) console.error(`[requests] ${fn} failed:`, error.code, error.message);
  return { ok: false, error: known ?? "failed" };
}

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function acceptRequest(id: string) {
  if (!isUuid(id)) return { ok: false, error: "invalid" } as const;
  return call("accept_request", { p_id: id });
}

export async function saveProgress(id: string, checklist: string[], nextMeeting: string | null) {
  if (!isUuid(id) || !checklist.every((i) => VALID_ITEMS.has(i))) return { ok: false, error: "invalid" } as const;
  if (nextMeeting && !/^\d{4}-\d{2}-\d{2}$/.test(nextMeeting)) return { ok: false, error: "invalid" } as const;
  return call("save_request_progress", { p_id: id, p_checklist: checklist, p_next_meeting: nextMeeting || null });
}

export async function reportIssue(id: string, kind: IssueKind, note: string) {
  if (!isUuid(id) || !ISSUE_KINDS.includes(kind)) return { ok: false, error: "invalid" } as const;
  return call("report_request_issue", { p_id: id, p_kind: kind, p_note: text(note, 1000) });
}

export async function releaseRequest(id: string, reason: ReleaseReason, note: string) {
  if (!isUuid(id) || !RELEASE_REASONS.includes(reason)) return { ok: false, error: "invalid" } as const;
  return call("release_request", { p_id: id, p_reason: reason, p_note: text(note, 1000) });
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

export async function resolveIssue(issueId: string) {
  if (!isUuid(issueId)) return { ok: false, error: "invalid" } as const;
  return call("resolve_request_issue", { p_issue_id: issueId });
}
