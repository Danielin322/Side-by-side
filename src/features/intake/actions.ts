"use server";

import { getSupabase } from "@/lib/supabase/server";
import { intakeSchema, normalizeIsraeliPhone, type IntakeValues } from "./schema";
import type { Locale } from "@/i18n/routing";

export type SubmitResult = { ok: true } | { ok: false; reason: "invalid" | "unavailable" | "failed" };

/** Validates the request again on the server and stores it through submit_help_request(). */
export async function submitHelpRequest(values: IntakeValues, locale: Locale): Promise<SubmitResult> {
  const parsed = intakeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const d = parsed.data;

  const supabase = getSupabase();
  if (!supabase) {
    console.error("[intake] SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not set.");
    return { ok: false, reason: "unavailable" };
  }

  const { error } = await supabase.rpc("submit_help_request", {
    p_support_types: d.supportTypes,
    p_meeting_mode: d.meetingMode,
    p_city: d.meetingMode === "in_person" ? d.city : null,
    p_language: d.language,
    p_note: d.note || null,
    p_first_name: d.firstName,
    p_last_name: d.lastName,
    p_phone: normalizeIsraeliPhone(d.phone),
    p_email: d.email || null,
    p_locale: locale === "en" ? "en" : "he",
  });

  if (error) {
    // Log the code only: never log the submitted personal details.
    console.error("[intake] submit_help_request failed:", error.code, error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}
