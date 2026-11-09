import type { Language, MeetingMode, SupportType } from "@/features/intake/schema";

/**
 * Checklist items per support type. Stored as "type.item" keys (see save_request_progress()).
 * Copy lives under "requests.checklist" in messages/*.json.
 */
export const CHECKLISTS: Record<SupportType, readonly string[]> = {
  documents: ["sorted", "downloaded", "ready"],
  rights: ["reviewed", "explained", "list"],
  co_typing: ["opened", "typed", "reviewed", "sent"],
  scheduling: ["found", "booked", "noted"],
  calls: ["prepared", "verified", "answers"],
  accompaniment: ["prepared", "arrived", "notes"],
  follow_up: ["reminder", "status", "next"],
};

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
  checklist: string[];
  next_meeting: string | null;
  assigned_at: string;
};

export type VolunteerProfile = {
  city: string;
  languages: { code: string; level: string }[];
  support_types: SupportType[];
  meeting_modes: Exclude<MeetingMode, "any">[];
};

export type FitBadges = { language: boolean; city: boolean; support: number; meeting: boolean };

const sameCity = (a: string | null, b: string) =>
  !!a && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

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

export type RequestActionResult =
  | { ok: true }
  | { ok: false; error: "not_approved" | "not_yours" | "not_open" | "limit_reached" | "forbidden" | "invalid" | "failed" };
