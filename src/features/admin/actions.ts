"use server";

import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";
import { VOLUNTEER_STATUSES, type VolunteerStatus } from "@/features/volunteer/schema";
import { israelLocalToIso } from "@/lib/time";

export type AdminState = { ok?: boolean; error?: "forbidden" | "invalid" | "failed" | "in_past" | "badLink" } | null;

/**
 * Admin changes run as the signed-in user. Row Level Security only lets admins update,
 * so a non-admin call updates zero rows and is reported as forbidden.
 */
export async function saveAdminNotes(_prev: AdminState, form: FormData): Promise<AdminState> {
  const id = String(form.get("id") ?? "");
  const notes = String(form.get("notes") ?? "").trim();
  if (!id || notes.length > 4000) return { error: "invalid" };

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("volunteer_sensitive")
    .update({ admin_notes: notes || null })
    .eq("volunteer_id", id)
    .select("volunteer_id");
  if (error) return { error: "failed" };
  if (!data?.length) return { error: "forbidden" };
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

/** Direct status change used by the volunteer quick actions (meeting scheduled, verify, etc.). */
export async function setVolunteerStatus(id: string, status: VolunteerStatus): Promise<AdminState> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !VOLUNTEER_STATUSES.includes(status)) return { error: "invalid" };
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("volunteers").update({ status }).eq("id", id).select("id");
  if (error) return { error: "failed" };
  if (!data?.length) return { error: "forbidden" };
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function rpcAsAdmin(fn: string, args: Record<string, unknown>): Promise<AdminState> {
  const supabase = await createSessionClient();
  const { error } = await supabase.rpc(fn, args);
  revalidatePath("/[locale]/admin", "layout");
  if (!error) return { ok: true };
  if (error.message === "forbidden" || error.message === "invalid" || error.message === "in_past") return { error: error.message };
  console.error(`[admin] ${fn} failed:`, error.code, error.message);
  return { error: "failed" };
}

/** Schedules or reschedules a verification meeting. Date and time are Israel-local. */
export async function scheduleMeeting(input: {
  volunteerId: string;
  date: string;
  time: string;
  link: string;
  note: string;
}): Promise<AdminState> {
  if (!isUuid(input.volunteerId)) return { error: "invalid" };
  const at = israelLocalToIso(input.date, input.time);
  if (!at) return { error: "invalid" };
  if (Date.parse(at) < Date.now() - 5 * 60_000) return { error: "in_past" };
  const link = input.link.trim();
  if (link && (!/^https?:\/\/\S+$/i.test(link) || link.length > 500)) return { error: "badLink" };
  return rpcAsAdmin("schedule_volunteer_meeting", {
    p_volunteer_id: input.volunteerId,
    p_scheduled_at: at,
    p_link: link,
    p_note: input.note.trim().slice(0, 1000),
  });
}

/** Cancels the open meeting, or records that it didn't happen. */
export async function closeMeeting(volunteerId: string, outcome: "cancelled" | "missed"): Promise<AdminState> {
  if (!isUuid(volunteerId) || (outcome !== "cancelled" && outcome !== "missed")) return { error: "invalid" };
  return rpcAsAdmin("close_volunteer_meeting", { p_volunteer_id: volunteerId, p_outcome: outcome });
}
