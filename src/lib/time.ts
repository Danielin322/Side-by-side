/** All meeting times are entered and shown in Israel time, whatever the viewer's device says. */
export const APP_TIME_ZONE = "Asia/Jerusalem";

function zoneParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Converts an Israel-local "YYYY-MM-DD" + "HH:MM" to a UTC ISO string, or null if invalid. Handles DST. */
export function israelLocalToIso(date: string, time: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const [y, m, d, h, min] = [+dm[1], +dm[2], +dm[3], +tm[1], +tm[2]];
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;
  const wanted = Date.UTC(y, m - 1, d, h, min);
  let guess = wanted;
  // Two passes settle the offset, including around daylight-saving changes.
  for (let i = 0; i < 2; i++) {
    const p = zoneParts(guess);
    const asIfUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    guess = wanted - (asIfUtc - guess);
  }
  const check = zoneParts(guess);
  if (check.y !== y || check.m !== m || check.d !== d) return null;
  return new Date(guess).toISOString();
}

/** Israel-local date and time strings for form fields, from an ISO timestamp. */
export function isoToIsraelLocal(iso: string): { date: string; time: string } {
  const p = zoneParts(new Date(iso).getTime());
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}` };
}

/** Today's date in Israel as "YYYY-MM-DD". */
export function israelToday(): string {
  return isoToIsraelLocal(new Date().toISOString()).date;
}

/** Whole calendar days from today (Israel) to the meeting's date: 0 = today, 1 = tomorrow, -1 = yesterday. */
export function israelDayDiff(iso: string): number {
  const a = israelToday();
  const b = isoToIsraelLocal(iso).date;
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

export function formatIsraelTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatIsraelDateTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** A date-only value like a request's "YYYY-MM-DD" next meeting, e.g. "Thursday, 20 Nov". */
export function formatDateOnly(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(date + "T00:00:00Z"));
}

/** The calendar day of a timestamp in Israel, e.g. "18 Nov 2026". */
export function formatIsraelDay(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
