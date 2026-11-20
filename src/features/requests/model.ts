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

/** Rule-based fit signals from scoreFit() in features/matching/score.ts. */
export type FitBadges = {
  language: boolean;
  city: boolean;
  /** In person in a nearby city (within 15 km, or 30 km with a car). */
  nearby: boolean;
  support: number;
  meeting: boolean;
  /** Nearby and the volunteer has a car. */
  transport: boolean;
};

/** Why a request suits a volunteer, as short translated chips (labels under "requests.bestMatch.tags"). */
export const FIT_TAGS = ["language", "same_city", "nearby", "meeting_mode", "support", "transport", "long_wait"] as const;
export type FitTag = (typeof FIT_TAGS)[number];

/** A request counts as waiting a while after this many days. */
export const LONG_WAIT_DAYS = 5;

export type BestMatchPick = { requestId: string; fitTags: FitTag[] };

export const normalizeCity = (c: string) => c.trim().toLocaleLowerCase();

export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));

export type RequestActionResult =
  | { ok: true }
  | { ok: false; error: "not_approved" | "not_yours" | "not_open" | "limit_reached" | "forbidden" | "invalid" | "failed" };
