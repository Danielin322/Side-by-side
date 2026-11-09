// About us — mission, partners, background. Content to be built later.
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { StubPage } from "@/components/ui/StubPage";

export default async function AboutPage(props: LocaleParams) {
  await resolveLocale(props);
  return <StubPage titleKey="about" />;
}
