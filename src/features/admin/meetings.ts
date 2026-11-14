import "server-only";
import { getTranslations } from "next-intl/server";
import { formatIsraelDateTime, formatIsraelTime, israelDayDiff } from "@/lib/time";

export type MeetingRow = {
  id: string;
  volunteer_id: string;
  scheduled_at: string;
  link: string | null;
  note: string | null;
  outcome: "scheduled" | "held" | "cancelled" | "missed";
  created_at: string;
};

/** Label for an open meeting: "Today 18:30", "Tomorrow 10:00", a full date, or "Meeting passed: verify?". */
export async function meetingBadge(iso: string, locale: string) {
  const t = await getTranslations("admin.meetings");
  if (Date.parse(iso) < Date.now()) return { text: t("passed", { when: formatIsraelDateTime(iso, locale) }), passed: true };
  const diff = israelDayDiff(iso);
  const time = formatIsraelTime(iso, locale);
  if (diff === 0) return { text: t("today", { time }), passed: false };
  if (diff === 1) return { text: t("tomorrow", { time }), passed: false };
  return { text: formatIsraelDateTime(iso, locale), passed: false };
}
