import "server-only";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  FIT_TAGS,
  daysSince,
  fitTagsFromBadges,
  scoreFit,
  type BestMatchPick,
  type FitTag,
} from "@/features/requests/model";
import { MAX_PICKS, SHORTLIST_SIZE, SYSTEM_PROMPT, rankSchema } from "./prompt";
import type { Candidate, MatchingStateType } from "./state";

type Update = Partial<MatchingStateType>;

export const DEFAULT_MODEL = "claude-haiku-5-5";
const LLM_TIMEOUT_MS = 8_000;

/** Best fit first; among equals, whoever has waited longest (same order as the "All requests" tab). */
const byScore = (a: Candidate, b: Candidate) => b.score - a.score || a.created_at.localeCompare(b.created_at);

/** Builds the privacy-safe volunteer view and scores every open request with the existing rules. */
export function prepare(state: MatchingStateType): Update {
  const { city, languages, support_types, meeting_modes, availability, transport } = state.profile;
  const candidates = state.requests.map((req, i): Candidate => {
    const { score, badges } = scoreFit(req, state.profile);
    return {
      key: `r${i + 1}`,
      requestId: req.id,
      support_types: req.support_types,
      meeting_mode: req.meeting_mode,
      city: req.meeting_mode === "in_person" ? req.city : null,
      language: req.language,
      days_waiting: daysSince(req.created_at, state.now),
      score,
      badges,
      created_at: req.created_at,
    };
  });
  return { volunteer: { city, languages, support_types, meeting_modes, availability, transport }, candidates };
}

/** Drops requests the volunteer can't serve at all, keeps the top 25 by score. */
export function shortlist(state: MatchingStateType): Update {
  const servable = state.candidates.filter((c) => c.badges.language || c.badges.meeting);
  return { candidates: servable.sort(byScore).slice(0, SHORTLIST_SIZE) };
}

/** Skip the LLM when there is nothing to choose between, or no API key. */
export function routeAfterShortlist(state: MatchingStateType): "rank" | "fallback" {
  return state.rulesOnly || state.candidates.length <= MAX_PICKS ? "fallback" : "rank";
}

/** One structured-output call to Claude. Errors and timeouts are recorded, then validate sends them to fallback. */
export async function rank(state: MatchingStateType): Promise<Update> {
  const model = process.env.MATCHING_MODEL || DEFAULT_MODEL;
  const llm = new ChatAnthropic({
    model,
    maxTokens: 600,
    maxRetries: 1,
    // No temperature: current models reject non-default sampling values with a 400.
    // Haiku 5.5 thinks by default; this is a simple ranking, so turn thinking off. That keeps the cost low and allows
    // the forced tool call that withStructuredOutput relies on. (Accepted on Haiku 5.5 at its default effort.)
    ...(model.startsWith("claude-haiku") ? { thinking: { type: "disabled" as const } } : {}),
  });
  const structured = llm.withStructuredOutput(rankSchema, { name: "best_matches" });
  const payload = {
    volunteer: state.volunteer,
    candidates: state.candidates.map(({ key, support_types, meeting_mode, city, language, days_waiting }) => ({
      key,
      support_types,
      meeting_mode,
      city,
      language,
      days_waiting,
    })),
  };
  try {
    const out = await structured.invoke(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) },
    );
    return { rawPicks: out.picks };
  } catch (e) {
    return { rawPicks: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Keeps only known candidate keys and tags, no duplicates, at most 8. */
export function validate(state: MatchingStateType): Update {
  const byKey = new Map(state.candidates.map((c) => [c.key, c]));
  const seen = new Set<string>();
  const picks: BestMatchPick[] = [];
  for (const p of state.rawPicks ?? []) {
    const c = byKey.get(p.requestId.trim());
    if (!c || seen.has(c.key)) continue;
    seen.add(c.key);
    const fitTags = [...new Set(p.fitTags)].filter((t): t is FitTag => (FIT_TAGS as readonly string[]).includes(t));
    picks.push({ requestId: c.requestId, fitTags });
    if (picks.length === MAX_PICKS) break;
  }
  return picks.length > 0 ? { picks, source: "ai" } : { picks: [] };
}

export function routeAfterValidate(state: MatchingStateType): "done" | "fallback" {
  return state.source === "ai" && state.picks.length > 0 ? "done" : "fallback";
}

/** Top 8 by scoreFit(), tags derived from the fit badges. Always works, no API needed. */
export function fallback(state: MatchingStateType): Update {
  const picks = [...state.candidates]
    .sort(byScore)
    .slice(0, MAX_PICKS)
    .map((c) => ({
      requestId: c.requestId,
      fitTags: fitTagsFromBadges(c.created_at, c.badges, state.now),
    }));
  return { picks, source: "rules" };
}
