import { getTranslations } from "next-intl/server";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { AuthCard, ForgotPasswordForm } from "@/features/auth/AuthForms";

export default async function ForgotPasswordPage(props: LocaleParams) {
  await resolveLocale(props);
  const t = await getTranslations("auth.forgot");
  return (
    <AuthCard title={t("title")} intro={t("intro")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
