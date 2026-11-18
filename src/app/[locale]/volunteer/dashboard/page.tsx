// Volunteer dashboard: an overview (verification, next meeting, activity) and four tabs:
// Opportunities (open requests), My requests (the ones they support now), My activity (meetings, history) and My profile.
// Reminder (PRD §2): hide help-seeker last name / exact address until a request is accepted.
import { getTranslations } from "next-intl/server";
import { BadgeCheck, HeartHandshake, Lock, ShieldCheck } from "lucide-react";
import { formatIsraelDay } from "@/lib/time";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { getViewer } from "@/features/auth/viewer";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { MAX_ACTIVE_REQUESTS } from "@/features/requests/model";
import { OpenRequestsPanel } from "@/features/requests/RequestsBoard";
import { loadDashboard } from "@/features/dashboard/data";
import { Overview, VerificationCard } from "@/features/dashboard/Overview";
import { ActivityPanel } from "@/features/dashboard/ActivityPanel";
import { RequestsPanel } from "@/features/dashboard/RequestsPanel";
import { ProfilePanel } from "@/features/dashboard/ProfilePanel";
import { DashboardTabs } from "@/features/dashboard/DashboardTabs";
import { DASHBOARD_TABS, type DashboardTab } from "@/features/dashboard/tabs";

export default async function VolunteerDashboardPage(props: LocaleParams) {
  const locale = await resolveLocale(props);
  const viewer = await getViewer();
  if (!viewer) redirect({ href: routes.volunteerLogin, locale });
  const t = await getTranslations("dashboard");
  const data = viewer!.volunteer ? await loadDashboard(viewer!.userId) : null;

  const adminLink = viewer!.isAdmin && (
    <Link
      href={routes.admin}
      className="mt-10 flex items-center gap-4 rounded-3xl bg-secondary-soft p-6 text-ink transition-shadow hover:shadow-soft"
    >
      <ShieldCheck aria-hidden className="size-6 text-secondary" />
      <span>
        <span className="block font-semibold">{t("admin.title")}</span>
        <span className="block text-sm text-ink-soft">{t("admin.body")}</span>
      </span>
    </Link>
  );

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="flex items-center gap-2 text-3xl font-semibold text-ink sm:text-4xl">
        {data ? t("hello", { name: data.details.full_name.split(" ")[0] }) : t("helloNoName")}
        {/* Verified badge beside the name, like a social profile's check mark. */}
        {data?.details.status === "approved" && (
          <BadgeCheck
            role="img"
            aria-label={t("overview.verified")}
            className="size-7 shrink-0 fill-secondary text-surface sm:size-8"
            strokeWidth={2}
          >
            <title>{t("overview.verified")}</title>
          </BadgeCheck>
        )}
      </h1>
      <SignOutButton />
    </div>
  );

  // Signed in, but no volunteer application (for example an admin account).
  if (!data) {
    return (
      <section className="container-page max-w-3xl py-10 sm:py-16">
        {header}
        <div className="mt-8 flex items-start gap-5 rounded-3xl bg-surface p-7 shadow-soft">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
            <HeartHandshake aria-hidden className="size-7 text-primary" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-ink">{t("noApplication.title")}</h2>
            <p className="mt-2 text-ink-soft">{t("noApplication.body")}</p>
            {!viewer!.isAdmin && (
              <Link href={routes.volunteer} className="btn-secondary mt-5">
                {t("noApplication.apply")}
              </Link>
            )}
          </div>
        </div>
        {adminLink}
      </section>
    );
  }

  const { details, myRequests, history, meetings, failed } = data;
  const status = details.status;
  const approved = status === "approved";
  const verificationMeeting = meetings.find((m) => m.kind === "verification");

  const opportunities = approved ? (
    <OpenRequestsPanel userId={viewer!.userId} profile={details} atLimit={myRequests.length >= MAX_ACTIVE_REQUESTS} />
  ) : (
    <div className="flex items-start gap-5 rounded-3xl bg-surface-soft p-7">
      <Lock aria-hidden className="mt-1 size-6 shrink-0 text-ink-soft" />
      <div>
        <h2 className="text-xl font-semibold text-ink">{t("locked.title")}</h2>
        <p className="mt-2 text-ink-soft">{t("locked.body")}</p>
      </div>
    </div>
  );

  return (
    <section className="container-page max-w-5xl py-10 sm:py-16">
      {header}

      <Overview
        status={status}
        meetings={meetings}
        activeCount={myRequests.length}
        completedCount={history ? history.filter((h) => h.kind === "completed").length : null}
      />

      {!approved && <VerificationCard status={status} meeting={verificationMeeting?.kind === "verification" ? verificationMeeting : undefined} />}

      <DashboardTabs
        label={t("tabs.label")}
        labels={Object.fromEntries(DASHBOARD_TABS.map((k) => [k, t(`tabs.${k}`)])) as Record<DashboardTab, string>}
        // Volunteers already supporting someone land on those requests; others start with what's open.
        defaultTab={approved ? (myRequests.length > 0 ? "requests" : "opportunities") : "profile"}
        panels={{
          opportunities,
          requests: <RequestsPanel approved={approved} myRequests={myRequests} failed={failed} />,
          activity: <ActivityPanel approved={approved} meetings={meetings} history={history} />,
          profile: <ProfilePanel details={details} memberSince={formatIsraelDay(details.created_at, locale)} />,
        }}
      />

      {adminLink}
    </section>
  );
}
