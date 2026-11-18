import { getLocale, getTranslations } from "next-intl/server";
import { CalendarCheck, CalendarDays, CircleCheck, Inbox, Undo2, Video } from "lucide-react";
import { formatIsraelDay } from "@/lib/time";
import type { HistoryItem, UpcomingMeeting } from "./data";
import { meetingText } from "./Overview";

export function Section({ id, title, aside, children }: { id: string; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 first:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-2xl font-semibold text-ink">
          {title}
        </h2>
        {aside && <p className="text-sm text-ink-soft">{aside}</p>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-4 rounded-3xl bg-surface-soft p-6 text-ink-soft">
      <Inbox aria-hidden className="size-6 shrink-0" />
      {children}
    </p>
  );
}

/** The Activity tab: upcoming meetings and what they've finished or handed back. Current requests have their own tab. */
export async function ActivityPanel({
  approved,
  meetings,
  history,
}: {
  approved: boolean;
  meetings: UpcomingMeeting[];
  history: HistoryItem[] | null;
}) {
  const t = await getTranslations("dashboard.activity");
  const tReq = await getTranslations("requests");
  const tIntake = await getTranslations("intake");
  const locale = await getLocale();
  const meetingLines = await Promise.all(meetings.map(meetingText));

  return (
    <>
      <Section id="meetings-title" title={t("meetings")}>
        {meetings.length === 0 ? (
          <Empty>{t("noMeetings")}</Empty>
        ) : (
          <ul className="space-y-3">
            {meetings.map((m, i) => {
              const Icon = m.kind === "verification" ? CalendarCheck : CalendarDays;
              return (
                <li key={m.sortKey + i} className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-5 shadow-soft">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
                    <Icon aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{meetingLines[i].when}</span>
                    <span className="block text-sm text-ink-soft">{meetingLines[i].title}</span>
                  </span>
                  {m.kind === "verification" && m.link && (
                    <a
                      href={m.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pill bg-primary px-4 py-2.5 text-primary-ink shadow-soft hover:bg-primary-hover"
                    >
                      <Video aria-hidden className="size-4" />
                      {t("join")}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>


      <Section id="history-title" title={t("history")}>
        {history === null ? (
          <Empty>{t("historyUnavailable")}</Empty>
        ) : history.length === 0 ? (
          <Empty>{approved ? t("historyEmpty") : t("notVerified")}</Empty>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => {
              const completed = h.kind === "completed";
              const Icon = completed ? CircleCheck : Undo2;
              const ended = formatIsraelDay(h.ended_at, locale);
              return (
                <li key={h.event_id} className="rounded-3xl bg-surface p-5 shadow-soft">
                  <div className="flex flex-wrap items-start gap-4">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${completed ? "bg-primary-soft" : "bg-surface-soft"}`}
                    >
                      <Icon aria-hidden className={`size-5 ${completed ? "text-primary" : "text-ink-soft"}`} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-semibold text-ink">{h.first_name}</span>
                        <span className="text-sm font-medium text-ink-soft">{t(completed ? "completed" : "released")}</span>
                      </p>
                      <p className="text-sm text-ink-soft">
                        {h.accepted_at ? t("period", { from: formatIsraelDay(h.accepted_at, locale), to: ended }) : ended}
                      </p>
                      <p className="mt-2 text-sm text-ink">
                        {h.support_types.map((s) => tIntake(`support.options.${s}.title`)).join(" · ")}
                      </p>
                      {completed && h.summary && (
                        <p className="mt-3 rounded-2xl bg-surface-soft p-3 text-sm text-ink">
                          <span className="block font-medium text-ink-soft">{t("summary")}</span>
                          {h.summary}
                        </p>
                      )}
                      {!completed && h.reason && (
                        <p className="mt-2 text-sm text-ink-soft">
                          {t("reason")}: {tReq(`release.reasons.${h.reason}`)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
