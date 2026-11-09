"use server";

import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";
import { VOLUNTEER_STATUSES, type VolunteerStatus } from "@/features/volunteer/schema";

export type AdminState = { ok?: boolean; error?: "forbidden" | "invalid" | "failed" } | null;

/**
 * Admin changes run as the signed-in user. Row Level Security only lets admins update,
 * so a non-admin call updates zero rows and is reported as forbidden.
 */
export async function updateVolunteerStatus(_prev: AdminState, form: FormData): Promise<AdminState> {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "") as VolunteerStatus;
  if (!id || !VOLUNTEER_STATUSES.includes(status)) return { error: "invalid" };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("volunteers").update({ status }).eq("id", id).select("id");
  if (error) return { error: "failed" };
  if (!data?.length) return { error: "forbidden" };
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

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
