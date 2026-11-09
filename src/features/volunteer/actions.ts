"use server";

import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import { normalizeIsraeliId, normalizeIsraeliPhone } from "@/lib/validation";
import { volunteerSchema, type VolunteerValues } from "./schema";
import type { Locale } from "@/i18n/routing";
import { siteOrigin } from "@/lib/origin";

export type ApplyResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; reason: "invalid" | "unavailable" | "emailTaken" | "weakPassword" | "rateLimited" | "failed" };

/**
 * Creates the volunteer's account and stores the application.
 * The account is created as the visitor; the application rows are written with the secret key,
 * because a new account has no session until its email is confirmed.
 */
export async function submitVolunteerApplication(values: VolunteerValues, locale: Locale): Promise<ApplyResult> {
  const parsed = volunteerSchema.safeParse(values);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const d = parsed.data;

  const admin = createAdminClient();
  if (!admin) {
    console.error("[volunteer] SUPABASE_URL / SUPABASE_SECRET_KEY are not set.");
    return { ok: false, reason: "unavailable" };
  }
  const supabase = await createSessionClient();

  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/api/auth/confirm?next=/${locale}/volunteer/dashboard`,
      data: { full_name: d.fullName },
    },
  });

  if (error) {
    console.error("[volunteer] signUp failed:", error.code);
    if (error.code === "user_already_exists" || error.code === "email_exists") return { ok: false, reason: "emailTaken" };
    if (error.code === "weak_password") return { ok: false, reason: "weakPassword" };
    if (error.code?.includes("rate_limit")) return { ok: false, reason: "rateLimited" };
    return { ok: false, reason: "failed" };
  }
  // With email confirmation on, Supabase hides "already registered" by returning a user with no identities.
  if (!data.user || data.user.identities?.length === 0) return { ok: false, reason: "emailTaken" };

  const languages = Object.entries(d.languages)
    .filter(([, lvl]) => lvl !== "")
    .map(([code, lvl]) => ({ code, level: lvl }));

  const { error: rpcError } = await admin.rpc("create_volunteer_application", {
    p_user_id: data.user.id,
    p_full_name: d.fullName,
    p_email: d.email,
    p_phone: normalizeIsraeliPhone(d.phone),
    p_city: d.city,
    p_occupation: d.occupation || null,
    p_availability: d.availability,
    p_commit_six_months: d.commitSixMonths === "yes",
    p_transport: d.transport,
    p_languages: languages,
    p_support_types: d.supportTypes,
    p_meeting_modes: d.meetingModes,
    p_experience: d.experience || null,
    p_motivation: d.motivation,
    p_skills: d.skills || null,
    p_national_id: normalizeIsraeliId(d.nationalId),
    p_birth_date: d.birthDate,
    p_locale: locale === "en" ? "en" : "he",
  });

  if (rpcError) {
    // Never log submitted personal details: code and message only.
    console.error("[volunteer] create_volunteer_application failed:", rpcError.code, rpcError.message);
    // Roll back the account so the person can try again with the same email.
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, reason: rpcError.code === "22023" ? "invalid" : "failed" };
  }

  return { ok: true, needsConfirmation: !data.session };
}
