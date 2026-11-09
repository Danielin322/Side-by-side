import { getTranslations } from "next-intl/server";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { getViewer } from "@/features/auth/viewer";
import { AuthCard, SignInForm } from "@/features/auth/AuthForms";

export default async function LoginPage(props: LocaleParams & { searchParams: Promise<{ error?: string }> }) {
  const locale = await resolveLocale(props);
  if (await getViewer()) redirect({ href: routes.volunteerDashboard, locale });
  const { error } = await props.searchParams;
  const t = await getTranslations("auth.signIn");
  return (
    <AuthCard title={t("title")} intro={t("intro")}>
      <SignInForm linkError={error === "link"} />
    </AuthCard>
  );
}
