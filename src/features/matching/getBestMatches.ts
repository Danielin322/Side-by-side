import "server-only";
import { createHash } from "node:crypto";
import type { BestMatches, OpenRequest, VolunteerProfile } from "@/features/requests/model";
import { matchingGraph } from "./graph";
import { fallback, prepare, shortlist } from "./nodes";
import type { MatchingStateType } from "./state";

const AI_TTL_MS = 24 * 60 * 60 * 1000;
const RULES_TTL_MS = 3 * 60 * 1000;
const MAX_ENTRIES = 500;

/**
 * Per-server-process cache. Next's unstable_cache can't pick a TTL from the result (24h for AI, 3 min for the
 * fallback) and can't share an in-flight call, so this is a small Map instead. On serverless hosts each instance
 * has its own copy, which only means an occasional extra run.
 */
const cache = new Map<string, { value: Promise<BestMatches>; expires: number }>();

const todayInIsrael = (now: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/**
 * Changes when any open request is added, taken or edited (updated_at), the volunteer edits their profile, or the
 * day changes (days waiting). The output has no text, so the UI locale isn't part of the key.
 */
function cacheKey(volunteerId: string, profile: VolunteerProfile, requests: OpenRequest[], now: number) {
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        requests.map((r) => `${r.id}:${r.updated_at ?? r.created_at}`).sort(),
        [profile.city, profile.languages, profile.support_types, profile.meeting_modes, profile.availability, profile.transport],
        todayInIsrael(now),
      ]),
    )
    .digest("hex");
  return `${volunteerId}:${hash}`;
}

function rulesOnly(input: Pick<MatchingStateType, "profile" | "requests" | "now">): BestMatches {
  let state = { ...input, rulesOnly: true } as MatchingStateType;
  state = { ...state, ...prepare(state) };
  state = { ...state, ...shortlist(state) };
  const { picks = [] } = fallback(state);
  return { picks, source: "rules" };
}

async function run(profile: VolunteerProfile, requests: OpenRequest[], now: number): Promise<BestMatches> {
  const started = Date.now();
  try {
    const out = await matchingGraph.invoke({ profile, requests, now, rulesOnly: !process.env.ANTHROPIC_API_KEY });
    console.info(
      `[matching] ${out.source} picks=${out.picks.length} open=${requests.length} in ${Date.now() - started}ms` +
        (out.error ? ` (llm error: ${out.error})` : ""),
    );
    return { picks: out.picks, source: out.source };
  } catch (e) {
    console.error("[matching] graph failed, using rules:", e instanceof Error ? e.message : e);
    return rulesOnly({ profile, requests, now });
  }
}

/**
 * The volunteer's best matches (up to 8). Never rejects: any failure falls back to scoreFit().
 * Called without await from OpenRequestsPanel, so the promise streams to the "Best matches" tab.
 */
export function getBestMatches(volunteerId: string, profile: VolunteerProfile, requests: OpenRequest[]): Promise<BestMatches> {
  const now = Date.now();
  if (requests.length === 0) return Promise.resolve({ picks: [], source: "rules" });

  const key = cacheKey(volunteerId, profile, requests, now);
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;

  // Store the in-flight promise right away so parallel loads share one LLM call, then set the real TTL.
  const value = run(profile, requests, now);
  cache.set(key, { value, expires: now + RULES_TTL_MS });
  value.then((r) => {
    if (cache.get(key)?.value === value) cache.set(key, { value, expires: Date.now() + (r.source === "ai" ? AI_TTL_MS : RULES_TTL_MS) });
  });

  // Drop expired entries, then the oldest ones, to keep memory bounded.
  if (cache.size > MAX_ENTRIES) {
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    for (const k of cache.keys()) {
      if (cache.size <= MAX_ENTRIES) break;
      cache.delete(k);
    }
  }
  return value;
}
