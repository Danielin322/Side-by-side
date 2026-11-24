// Volunteer application (PRD §5). Signed-in volunteers go straight to their dashboard.
// An admin without a volunteer profile fills one in here for their own account (every admin is also a volunteer).
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { getViewer } from "@/features/auth/viewer";
import { VolunteerApplication } from "@/features/volunteer/VolunteerApplication";

export default async function VolunteerPage(props: LocaleParams) {
  const locale = await resolveLocale(props);
  const viewer = await getViewer();
  if (viewer?.volunteer) redirect({ href: routes.volunteerDashboard, locale });
  return <VolunteerApplication mode={viewer?.isAdmin ? "admin" : "signup"} />;
}
