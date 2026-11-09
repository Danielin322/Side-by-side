// Scope of support / disclaimer (PRD §5). Content to be built later.
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { StubPage } from "@/components/ui/StubPage";

export default async function TermsPage(props: LocaleParams) {
  await resolveLocale(props);
  return <StubPage titleKey="terms" />;
}
