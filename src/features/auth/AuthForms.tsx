"use client";

import { useActionState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { Notice } from "@/components/form/FormParts";
import { requestPasswordReset, signIn, updatePassword, type AuthState } from "./actions";

/** Centered card used by the sign-in, forgot-password and reset-password pages. */
export function AuthCard({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="container-page max-w-md py-12 sm:py-20">
      <h1 className="text-3xl font-semibold text-ink">{title}</h1>
      {intro && <p className="mt-3 text-lg text-ink-soft">{intro}</p>}
      <div className="mt-8 rounded-3xl bg-surface p-6 shadow-soft sm:p-8">{children}</div>
    </section>
  );
}

function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={input.name} className="block font-medium text-ink">
        {label}
      </label>
      <input
        id={input.name}
        {...input}
        className="mt-2 w-full rounded-2xl bg-surface-soft px-4 py-3 text-lg text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary"
      />
    </div>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="pill w-full justify-center bg-primary py-3.5 text-lg text-primary-ink shadow-soft hover:bg-primary-hover disabled:opacity-70"
    >
      {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
      {children}
    </button>
  );
}

function useAuthT() {
  const t = useTranslations("auth");
  return (state: AuthState) => (state?.error ? t(`errors.${state.error}` as Parameters<typeof t>[0]) : null);
}

export function SignInForm({ linkError }: { linkError?: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const errorText = useAuthT();
  const [state, action, pending] = useActionState(signIn, null);
  const message = errorText(state) ?? (linkError ? t("errors.linkExpired") : null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("email")} name="email" type="email" autoComplete="email" required dir="ltr" />
      <Field label={t("password")} name="password" type="password" autoComplete="current-password" required dir="ltr" />
      {message && <Notice role="alert">{message}</Notice>}
      <SubmitButton pending={pending}>{t("signIn.submit")}</SubmitButton>
      <div className="flex flex-col gap-2 text-sm">
        <Link href={routes.volunteerForgot} className="text-primary underline underline-offset-4">
          {t("signIn.forgot")}
        </Link>
        <p className="text-ink-soft">
          {t("signIn.noAccount")}{" "}
          <Link href={routes.volunteer} className="font-medium text-primary underline underline-offset-4">
            {t("signIn.apply")}
          </Link>
        </p>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const errorText = useAuthT();
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.sent) return <Notice role="status">{t("forgot.sent")}</Notice>;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("email")} name="email" type="email" autoComplete="email" required dir="ltr" />
      {errorText(state) && <Notice role="alert">{errorText(state)}</Notice>}
      <SubmitButton pending={pending}>{t("forgot.submit")}</SubmitButton>
      <Link href={routes.volunteerLogin} className="block text-sm text-primary underline underline-offset-4">
        {t("backToSignIn")}
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const errorText = useAuthT();
  const [state, action, pending] = useActionState(updatePassword, null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("reset.password")} name="password" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
      <Field label={t("reset.passwordConfirm")} name="passwordConfirm" type="password" autoComplete="new-password" required dir="ltr" />
      {errorText(state) && <Notice role="alert">{errorText(state)}</Notice>}
      <SubmitButton pending={pending}>{t("reset.submit")}</SubmitButton>
    </form>
  );
}
