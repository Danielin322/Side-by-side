// Intake Flow — zero-friction intake for help-seekers. Content to be built later.
// Reminder (PRD §2): no file uploads / medical documents in this flow.
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { StubPage } from "@/components/ui/StubPage";

export default async function AskForHelpPage(props: LocaleParams) {
  await resolveLocale(props);
  return <StubPage titleKey="askForHelp" />;
}
