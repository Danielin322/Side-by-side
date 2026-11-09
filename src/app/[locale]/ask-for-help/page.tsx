// Intake Flow — zero-friction help request (PRD §3).
// Reminder (PRD §2): no file uploads / medical documents in this flow.
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { IntakeFlow } from "@/features/intake/IntakeFlow";

export default async function AskForHelpPage(props: LocaleParams) {
  await resolveLocale(props);
  return <IntakeFlow />;
}
