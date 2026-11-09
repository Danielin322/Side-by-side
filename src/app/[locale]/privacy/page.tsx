// Safety & legal privacy — data protection, no medical records, legal boundaries. Content to be built later.
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { StubPage } from "@/components/ui/StubPage";

export default async function PrivacyPage(props: LocaleParams) {
  await resolveLocale(props);
  return <StubPage titleKey="privacy" />;
}
