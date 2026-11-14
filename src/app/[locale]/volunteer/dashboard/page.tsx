// Volunteer Dashboard. Shows application status; approved volunteers get the requests board.
// Reminder (PRD §2): hide help-seeker last name / exact address until a request is accepted.
import { getTranslations } from "next-intl/server";
import { CalendarCheck, CircleCheck, Clock, HeartHandshake, ShieldCheck, Video } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { formatIsraelDateTime } from "@/lib/time";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { getViewer } from "@/features/auth/viewer";
import { SignOutButton } from "@/features/auth/SignOutButton";
import type { VolunteerStatus } from "@/features/volunteer/schema";
import { RequestsBoard } from "@/features/requests/RequestsBoard";

const STATUS_ICON: Record<VolunteerStatus, typeof Clock> = {
  applied: Clock,
  interview: CalendarCheck,
  approved: CircleCheck,
  not_approved: HeartHandshake,
};

export default async function VolunteerDashboardPage(props: LocaleParams) {
  const locale = await resolveLocale(props);
  const viewer = await getViewer();
  if (!viewer) redirect({ href: routes.volunteerLogin, locale });
  const t = await getTranslations("dashboard");
  const status = viewer!.volunteer?.status;
  const Icon = status ? STATUS_ICON[status] : HeartHandshake;
  const approved = status === "approved";
  // Their upcoming verification meeting (time and link only; the admin's note stays private).
  const meeting =
    status === "interview"
      ? ((await (await createSessionClient()).rpc("get_my_meeting")).data as { scheduled_at: string; link: string | null }[] | null)?.[0] ?? null
      : null;

  return (
    <section className="container-page max-w-3xl py-10 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
          {viewer!.volunteer ? t("hello", { name: viewer!.volunteer.full_name.split(" ")[0] }) : t("helloNoName")}
        </h1>
        <SignOutButton />
      </div>

      {!approved && (
      <div className="mt-8 rounded-3xl bg-surface p-7 shadow-soft">
        <div className="flex items-start gap-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
            <Icon aria-hidden className="size-7 text-primary" strokeWidth={1.75} />
          </span>
          <div>
            {status ? (
              <>
                <p className="text-sm font-medium text-secondary">{t(`status.${status}.label`)}</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">{t(`status.${status}.title`)}</h2>
                {meeting ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-lg font-medium text-ink">
                      {t("meeting", { when: formatIsraelDateTime(meeting.scheduled_at, locale) })}
                    </p>
                    {meeting.link && (
                      <a
                        href={meeting.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pill bg-primary px-4 py-2.5 text-primary-ink shadow-soft hover:bg-primary-hover"
                      >
                        <Video aria-hidden className="size-4" />
                        {t("join")}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-ink-soft">{t(`status.${status}.body`)}</p>
                )}
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-ink">{t("noApplication.title")}</h2>
                <p className="mt-2 text-ink-soft">{t("noApplication.body")}</p>
                {!viewer!.isAdmin && (
                  <Link href={routes.volunteer} className="btn-secondary mt-5">
                    {t("noApplication.apply")}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {approved && <RequestsBoard userId={viewer!.userId} />}

      {viewer!.isAdmin && (
        <Link
          href={routes.admin}
          className="mt-6 flex items-center gap-4 rounded-3xl bg-secondary-soft p-6 text-ink transition-shadow hover:shadow-soft"
        >
          <ShieldCheck aria-hidden className="size-6 text-secondary" />
          <span>
            <span className="block font-semibold">{t("admin.title")}</span>
            <span className="block text-sm text-ink-soft">{t("admin.body")}</span>
          </span>
        </Link>
      )}
    </section>
  );
}
