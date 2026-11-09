import { getTranslations } from "next-intl/server";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { getViewer } from "@/features/auth/viewer";
import { AuthCard, ResetPasswordForm } from "@/features/auth/AuthForms";

// Reached from the reset email link, which signs the user in first (see /api/auth/confirm).
export default async function ResetPasswordPage(props: LocaleParams) {
  const locale = await resolveLocale(props);
  if (!(await getViewer())) redirect({ href: `${routes.volunteerLogin}?error=link`, locale });
  const t = await getTranslations("auth.reset");
  return (
    <AuthCard title={t("title")} intro={t("intro")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
