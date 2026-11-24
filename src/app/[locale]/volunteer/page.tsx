// Volunteer application (PRD §5). Signed-in volunteers go straight to their dashboard.
// A signed-in account without a volunteer profile applies here for itself, with no account step; an admin's profile is
// approved at once (every admin is also a volunteer).
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { getViewer } from "@/features/auth/viewer";
import { VolunteerApplication } from "@/features/volunteer/VolunteerApplication";

export default async function VolunteerPage(props: LocaleParams) {
  const locale = await resolveLocale(props);
  const viewer = await getViewer();
  if (viewer?.volunteer) redirect({ href: routes.volunteerDashboard, locale });
  return viewer ? <VolunteerApplication mode="signedIn" admin={viewer.isAdmin} /> : <VolunteerApplication />;
}
