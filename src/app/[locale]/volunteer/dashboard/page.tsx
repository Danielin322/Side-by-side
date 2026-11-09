// Volunteer Dashboard — content to be built later.
// Reminder (PRD §2): hide help-seeker last name / exact address until a request is accepted.
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { StubPage } from "@/components/ui/StubPage";

export default async function VolunteerDashboardPage(props: LocaleParams) {
  await resolveLocale(props);
  return <StubPage titleKey="volunteerDashboard" />;
}
