"use server";

import { z } from "zod";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { redirect } from "@/i18n/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/origin";
import { routes } from "@/lib/routes";
import { routing, type Locale } from "@/i18n/routing";
import { errorMeta, logEvent } from "@/lib/logs";

export type AuthState = { error?: string; sent?: boolean } | null;

const localeOf = (form: FormData): Locale => {
  const value = form.get("locale");
  return routing.locales.includes(value as Locale) ? (value as Locale) : routing.defaultLocale;
};

const emailSchema = z.string().trim().pipe(z.email());

/** Sign in with email and password, then go to the dashboard. */
export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const email = emailSchema.safeParse(form.get("email"));
  const password = String(form.get("password") ?? "");
  if (!email.success || !password) return { error: "missingFields" };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) {
    await logEvent({
      severity: "warning",
      category: "auth",
      event: "auth.login_failed",
      message: `Failed login attempt (${error.code ?? "unknown"})`,
      metadata: errorMeta(error),
      actorLabel: email.data,
    });
    // Supabase couldn't be reached (no internet, timeout): the password was never checked.
    if (isAuthRetryableFetchError(error)) return { error: "network" };
    if (error.code === "email_not_confirmed") return { error: "notConfirmed" };
    if (error.code?.includes("rate_limit")) return { error: "rateLimited" };
    return { error: "invalidCredentials" };
  }
  redirect({ href: routes.volunteerDashboard, locale });
  return null;
}

export async function signOut(form: FormData) {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect({ href: routes.home, locale: localeOf(form) });
}

/** Always reports "sent" so the form doesn't reveal which emails have accounts. */
export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "emailInvalid" };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await siteOrigin()}/api/auth/confirm?next=/${locale}${routes.volunteerReset}`,
  });
  if (error?.code?.includes("rate_limit")) return { error: "rateLimited" };
  if (error) {
    await logEvent({
      severity: "error",
      category: "auth",
      event: "auth.email_failed",
      message: "Password reset email could not be sent",
      metadata: { flow: "password_reset", ...errorMeta(error) },
      actorLabel: email.data,
    });
  }
  return { sent: true };
}

/** Sets a new password for the user signed in through the reset link. */
export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("passwordConfirm") ?? "");
  if (password.length < 8) return { error: "passwordShort" };
  if (password !== confirm) return { error: "passwordMismatch" };

  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "linkExpired" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? "samePassword" : "failed" };
  redirect({ href: routes.volunteerDashboard, locale });
  return null;
}
