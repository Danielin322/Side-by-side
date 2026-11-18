import { getLocale, getTranslations } from "next-intl/server";
import { CalendarCheck, CalendarDays, Check, Clock, HeartHandshake, ShieldCheck, Video, type LucideIcon } from "lucide-react";
import { formatDateOnly, formatIsraelDateTime } from "@/lib/time";
import type { VolunteerStatus } from "@/features/volunteer/schema";
import type { UpcomingMeeting } from "./data";

const STATUS_ICON: Record<VolunteerStatus, LucideIcon> = {
  applied: Clock,
  interview: CalendarCheck,
  approved: ShieldCheck,
  not_approved: HeartHandshake,
};

/** One line describing a meeting, shared by the overview card and the Activity tab. */
export async function meetingText(m: UpcomingMeeting) {
  const t = await getTranslations("dashboard.overview");
  const locale = await getLocale();
  return m.kind === "verification"
    ? { title: t("verificationMeeting"), when: formatIsraelDateTime(m.at, locale) }
    : { title: t("requestMeeting", { name: m.firstName }), when: formatDateOnly(m.date, locale) };
}

function Card({ Icon, label, children }: { Icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4 rounded-3xl bg-surface p-5 shadow-soft">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
        <Icon aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-soft">{label}</p>
        {children}
      </div>
    </li>
  );
}

/** Two cards at the top: the next meeting and activity numbers. Verification shows as a badge by the name. */
export async function Overview({
  status,
  meetings,
  activeCount,
  completedCount,
}: {
  status: VolunteerStatus;
  meetings: UpcomingMeeting[];
  activeCount: number;
  completedCount: number | null;
}) {
  const t = await getTranslations("dashboard");
  const approved = status === "approved";
  const next = meetings[0] ? await meetingText(meetings[0]) : null;

  return (
    <ul aria-label={t("overview.label")} className="mt-8 grid gap-4 sm:grid-cols-2">
      <Card Icon={CalendarDays} label={t("overview.nextMeeting")}>
        {next ? (
          <>
            <p className="mt-0.5 font-semibold text-ink">{next.when}</p>
            <p className="text-sm text-ink-soft">{next.title}</p>
            {meetings.length > 1 && <p className="mt-1 text-sm text-ink-soft">{t("overview.more", { count: meetings.length - 1 })}</p>}
          </>
        ) : (
          <p className="mt-0.5 font-semibold text-ink">{t("overview.noMeetings")}</p>
        )}
      </Card>

      <Card Icon={HeartHandshake} label={t("overview.activity")}>
        {approved ? (
          <p className="mt-0.5 font-semibold text-ink">
            {t("overview.active", { count: activeCount })}
            {/* Only shown once they've completed something. */}
            {!!completedCount && (
              <span className="block text-sm font-normal text-ink-soft">{t("overview.completed", { count: completedCount })}</span>
            )}
          </p>
        ) : (
          <p className="mt-0.5 font-semibold text-ink">{t("overview.activityLocked")}</p>
        )}
      </Card>
    </ul>
  );
}

const STEPS = ["applied", "interview", "approved"] as const;

/** For volunteers who aren't verified yet: where they are in the process, and their video chat if one is set. */
export async function VerificationCard({
  status,
  meeting,
}: {
  status: Exclude<VolunteerStatus, "approved">;
  meeting: Extract<UpcomingMeeting, { kind: "verification" }> | undefined;
}) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const Icon = STATUS_ICON[status];

  if (status === "not_approved") {
    return (
      <div className="mt-8 flex items-start gap-5 rounded-3xl bg-surface p-7 shadow-soft">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
          <Icon aria-hidden className="size-7 text-primary" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-ink">{t("status.not_approved.title")}</h2>
          <p className="mt-2 text-ink-soft">{t("status.not_approved.body")}</p>
        </div>
      </div>
    );
  }

  const current = STEPS.indexOf(status);
  return (
    <section aria-labelledby="verification-title" className="mt-8 rounded-3xl bg-surface p-7 shadow-soft">
      <h2 id="verification-title" className="text-xl font-semibold text-ink">
        {t("steps.title")}
      </h2>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li
              key={step}
              aria-current={now ? "step" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${now ? "bg-primary-soft text-ink" : "bg-surface-soft text-ink-soft"}`}
            >
              <span
                aria-hidden
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  done ? "bg-primary text-primary-ink" : now ? "bg-surface text-ink ring-2 ring-primary" : "bg-surface text-ink-soft"
                }`}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={now ? "font-medium" : ""}>
                {t(`steps.${step}`)}
                {done && <span className="sr-only"> ({t("steps.done")})</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <h3 className="font-semibold text-ink">{t(`status.${status}.title`)}</h3>
        {meeting ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-lg font-medium text-ink">{t("meeting", { when: formatIsraelDateTime(meeting.at, locale) })}</p>
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
      </div>
    </section>
  );
}
