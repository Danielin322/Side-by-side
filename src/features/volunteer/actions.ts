"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import { normalizeIsraeliId, normalizeIsraeliPhone } from "@/lib/validation";
import { languagesFromForm, profileSchema, volunteerSchema, type ProfileValues, type VolunteerValues } from "./schema";
import type { Locale } from "@/i18n/routing";
import { siteOrigin } from "@/lib/origin";
import { errorMeta, logError, logEvent } from "@/lib/logs";

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
    await logError("system", "system.misconfigured", "[volunteer] SUPABASE_URL / SUPABASE_SECRET_KEY are not set.");
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
    const emailFailure = /email/i.test(error.message) && /send|deliver|smtp/i.test(error.message);
    if (emailFailure || !["user_already_exists", "email_exists", "weak_password"].includes(error.code ?? "")) {
      await logEvent({
        severity: emailFailure ? "error" : "warning",
        category: "auth",
        event: emailFailure ? "auth.email_failed" : "auth.signup_failed",
        message: emailFailure ? "Confirmation email could not be sent" : `Volunteer sign-up failed: ${error.code ?? "unknown"}`,
        metadata: { flow: "signup", ...errorMeta(error) },
        actorLabel: d.email,
      });
    }
    if (error.code === "user_already_exists" || error.code === "email_exists") return { ok: false, reason: "emailTaken" };
    if (error.code === "weak_password") return { ok: false, reason: "weakPassword" };
    if (error.code?.includes("rate_limit")) return { ok: false, reason: "rateLimited" };
    return { ok: false, reason: "failed" };
  }
  // With email confirmation on, Supabase hides "already registered" by returning a user with no identities.
  if (!data.user || data.user.identities?.length === 0) return { ok: false, reason: "emailTaken" };

  const languages = languagesFromForm(d.languages);

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
    await logError("volunteers", "system.rpc_failed", "[volunteer] create_volunteer_application failed", { fn: "create_volunteer_application", ...errorMeta(rpcError) });
    // Roll back the account so the person can try again with the same email.
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, reason: rpcError.code === "22023" ? "invalid" : "failed" };
  }

  return { ok: true, needsConfirmation: !data.session };
}

export type ProfileResult = { ok: true } | { ok: false; reason: "invalid" | "failed" };

/** Saves the practical parts of the signed-in volunteer's profile. Their session decides whose row changes. */
export async function updateMyProfile(values: ProfileValues): Promise<ProfileResult> {
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const d = parsed.data;

  const supabase = await createSessionClient();
  const { error } = await supabase.rpc("update_my_volunteer_profile", {
    p_phone: normalizeIsraeliPhone(d.phone),
    p_city: d.city,
    p_occupation: d.occupation || null,
    p_availability: d.availability,
    p_transport: d.transport,
    p_languages: languagesFromForm(d.languages),
    p_support_types: d.supportTypes,
    p_meeting_modes: d.meetingModes,
  });

  if (error) {
    // Code and message only: never log the submitted details.
    await logError("volunteers", "system.rpc_failed", "[volunteer] update_my_volunteer_profile failed", { fn: "update_my_volunteer_profile", ...errorMeta(error) });
    return { ok: false, reason: error.message === "invalid" || error.code === "23514" ? "invalid" : "failed" };
  }
  revalidatePath("/[locale]/volunteer/dashboard", "page");
  return { ok: true };
}
