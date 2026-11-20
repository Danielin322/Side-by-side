import {
  LONG_WAIT_DAYS,
  daysSince,
  type BestMatchPick,
  type FitBadges,
  type FitTag,
  type OpenRequest,
  type VolunteerProfile,
} from "@/features/requests/model";
import { cityDistanceKm, isSameCity } from "./cities";

/** How many requests the "Best matches" tab shows. */
export const MAX_PICKS = 8;
/** An in-person request this close counts as nearby. */
export const NEARBY_KM = 15;
/** ...or this close when the volunteer has a car. */
export const NEARBY_BY_CAR_KM = 30;

/**
 * Scores how well a request suits a volunteer. Higher is better; nothing is filtered out.
 *
 *   language   +6 (native/good) or +4 (basic)   the volunteer must be able to talk with the person
 *   meeting    +2                                the meeting format is one the volunteer offers
 *   location   +3 same city, +2 nearby           in-person only; nearby = within 15 km, or 30 km with a car
 *   support    +2 per matching support type
 *
 * Among equal scores, callers sort whoever has waited longest first.
 */
export function scoreFit(req: OpenRequest, v: VolunteerProfile): { score: number; badges: FitBadges } {
  const lang = v.languages.find((l) => l.code === req.language);
  const language = !!lang;
  const support = req.support_types.filter((s) => v.support_types.includes(s)).length;
  const meeting = req.meeting_mode === "any" || v.meeting_modes.includes(req.meeting_mode);

  const inPerson = req.meeting_mode === "in_person";
  const city = inPerson && isSameCity(req.city, v.city);
  const hasCar = v.transport.includes("car");
  const km = inPerson && !city ? cityDistanceKm(req.city, v.city) : null;
  const nearby = km !== null && km <= (hasCar ? NEARBY_BY_CAR_KM : NEARBY_KM);
  const transport = nearby && hasCar;

  const score =
    (lang ? (lang.level === "basic" ? 4 : 6) : 0) + (meeting ? 2 : 0) + (city ? 3 : nearby ? 2 : 0) + support * 2;
  return { score, badges: { language, city, nearby, support, meeting, transport } };
}

/** The "why it fits" chips for a Best match. */
export function fitTags(createdAt: string, badges: FitBadges, now = Date.now()): FitTag[] {
  const tags: FitTag[] = [];
  if (badges.language) tags.push("language");
  if (badges.city) tags.push("same_city");
  if (badges.nearby) tags.push("nearby");
  if (badges.meeting) tags.push("meeting_mode");
  if (badges.support > 0) tags.push("support");
  if (badges.transport) tags.push("transport");
  if (daysSince(createdAt, now) >= LONG_WAIT_DAYS) tags.push("long_wait");
  return tags;
}

/**
 * The volunteer's best matches: requests they can actually serve (shared language and a meeting format they offer),
 * top 8 of `ranked`, which must already be sorted best first.
 */
export function pickBestMatches(ranked: { req: OpenRequest; badges: FitBadges }[], now = Date.now()): BestMatchPick[] {
  return ranked
    .filter(({ badges }) => badges.language && badges.meeting)
    .slice(0, MAX_PICKS)
    .map(({ req, badges }) => ({ requestId: req.id, fitTags: fitTags(req.created_at, badges, now) }));
}
