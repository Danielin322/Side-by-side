import { Annotation } from "@langchain/langgraph";
import type { BestMatchPick, FitBadges, OpenRequest, VolunteerProfile } from "@/features/requests/model";

/**
 * What the LLM sees about the volunteer. Deliberately no name, phone, email or ID (PRD §2).
 */
export type VolunteerView = Pick<VolunteerProfile, "city" | "languages" | "support_types" | "meeting_modes" | "availability" | "transport">;

/**
 * One open request as the LLM sees it. `key` is a short alias ("r1", "r2", ...) used instead of the UUID:
 * fewer tokens, and the model can't invent a real-looking id. No first name, note or contact details.
 */
export type Candidate = {
  key: string;
  requestId: string;
  support_types: OpenRequest["support_types"];
  meeting_mode: OpenRequest["meeting_mode"];
  city: string | null;
  language: OpenRequest["language"];
  days_waiting: number;
  /** From scoreFit(); used for the shortlist order and the fallback. */
  score: number;
  badges: FitBadges;
  created_at: string;
};

export const MatchingState = Annotation.Root({
  // ---- input
  profile: Annotation<VolunteerProfile>,
  requests: Annotation<OpenRequest[]>,
  now: Annotation<number>,
  /** True when no API key is set: go straight to the rules. */
  rulesOnly: Annotation<boolean>,
  // ---- working state
  volunteer: Annotation<VolunteerView>,
  candidates: Annotation<Candidate[]>,
  /** Raw picks from the LLM, before validation. */
  rawPicks: Annotation<{ requestId: string; fitTags: string[] }[]>,
  // ---- output
  picks: Annotation<BestMatchPick[]>,
  source: Annotation<"ai" | "rules">,
  error: Annotation<string | undefined>,
});

export type MatchingStateType = typeof MatchingState.State;
