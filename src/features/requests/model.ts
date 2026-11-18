import type { Language, MeetingMode, SupportType } from "@/features/intake/schema";

/** One step on a volunteer's own checklist for a request (stored in help_requests.checklist_items). */
export type ChecklistItem = { id: string; text: string; done: boolean };
export const MAX_CHECKLIST_ITEMS = 40;
export const MAX_CHECKLIST_TEXT = 200;

export const MAX_ACTIVE_REQUESTS = 3;
export const ISSUE_KINDS = ["unreachable", "professional", "safety", "coordinator"] as const;
export const RELEASE_REASONS = ["availability", "not_fit", "asked_other", "other"] as const;
export const REQUEST_STATUSES = ["open", "in_progress", "completed", "closed"] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];
export type ReleaseReason = (typeof RELEASE_REASONS)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** What a volunteer sees before accepting (from list_open_requests()). */
export type OpenRequest = {
  id: string;
  created_at: string;
  /** Last change (migration 0005). Optional so the board still works before that migration runs. */
  updated_at?: string;
  support_types: SupportType[];
  meeting_mode: MeetingMode;
  city: string | null;
  language: Language;
  first_name: string;
};

/** A request the volunteer holds (from list_my_requests()). */
export type MyRequest = OpenRequest & {
  last_name: string;
  phone: string;
  email: string | null;
  note: string | null;
  checklist_items: ChecklistItem[];
  next_meeting: string | null;
  assigned_at: string;
};

export type VolunteerProfile = {
  city: string;
  languages: { code: string; level: string }[];
  support_types: SupportType[];
  meeting_modes: Exclude<MeetingMode, "any">[];
  /** Weekly slots like "sun_morning" (see AVAILABILITY_SLOTS in features/volunteer/schema.ts). */
  availability: string[];
  transport: ("license" | "car" | "public_transit")[];
};

export type FitBadges = { language: boolean; city: boolean; support: number; meeting: boolean };

/** Why a request suits a volunteer, as short translated chips (labels under "requests.bestMatch.tags"). */
export const FIT_TAGS = ["language", "same_city", "nearby", "meeting_mode", "support", "transport", "long_wait"] as const;
export type FitTag = (typeof FIT_TAGS)[number];

/** A request counts as waiting a while after this many days. */
export const LONG_WAIT_DAYS = 5;

export type BestMatchPick = { requestId: string; fitTags: FitTag[] };
/** "ai" = ranked by the matching agent; "rules" = scoreFit() fallback. */
export type BestMatches = { picks: BestMatchPick[]; source: "ai" | "rules" };

export const normalizeCity = (c: string) => c.trim().toLocaleLowerCase();
const sameCity = (a: string | null, b: string) => !!a && normalizeCity(a) === normalizeCity(b);

export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));

/**
 * Scores how well a request suits a volunteer. Higher is better; nothing is filtered out.
 * Language matters most, then same city for in-person, then overlapping support and a workable meeting mode.
 */
export function scoreFit(req: OpenRequest, v: VolunteerProfile): { score: number; badges: FitBadges } {
  const language = v.languages.some((l) => l.code === req.language);
  const support = req.support_types.filter((s) => v.support_types.includes(s)).length;
  const meeting = req.meeting_mode === "any" || v.meeting_modes.includes(req.meeting_mode);
  const city = req.meeting_mode === "in_person" && sameCity(req.city, v.city);
  const score = (language ? 6 : 0) + (city ? 3 : 0) + support * 2 + (meeting ? 2 : 0);
  return { score, badges: { language, city, support, meeting } };
}

/** Fit tags the rules can prove on their own (the agent may add "nearby" and "transport"). */
export function fitTagsFromBadges(createdAt: string, badges: FitBadges, now = Date.now()): FitTag[] {
  const tags: FitTag[] = [];
  if (badges.language) tags.push("language");
  if (badges.city) tags.push("same_city");
  if (badges.meeting) tags.push("meeting_mode");
  if (badges.support > 0) tags.push("support");
  if (daysSince(createdAt, now) >= LONG_WAIT_DAYS) tags.push("long_wait");
  return tags;
}

export type RequestActionResult =
  | { ok: true }
  | { ok: false; error: "not_approved" | "not_yours" | "not_open" | "limit_reached" | "forbidden" | "invalid" | "failed" };
