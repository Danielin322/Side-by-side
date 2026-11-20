# Decision page

The important choices made while building Side by Side: what we picked, why, and what we didn't pick.
Use it to answer "why is it done this way?".

New decisions go at the top of their section. Each entry has a date (when it was made or first shipped), the
decision, the reason, and where to find it in the code. Where the reason was never written down, the entry says
**Reason not recorded**. Fill those in when you can.

**Contents**

1. [Best match agent (AI)](#1-best-match-agent-ai)
2. [Product and safety rules](#2-product-and-safety-rules)
3. [Tech stack](#3-tech-stack)
4. [Data and privacy](#4-data-and-privacy)
5. [Language, design and accessibility](#5-language-design-and-accessibility)

---

## 1. Best match agent (AI)

The "Best matches" tab on the volunteer dashboard. It picks the open requests that best fit a volunteer.

### Model: Claude Haiku 5.5 (`claude-haiku-5-5`)
- **Date:** 2026-11-17
- **Decision:** Ranking uses Claude Haiku 5.5 by default. The `MATCHING_MODEL` env var can switch to another model without a code change.
- **Why:** Ranking a short list of requests is a simple task. Haiku is the cheapest and fastest Claude model and is good enough for it.
- **Details:** Thinking is turned off on Haiku. That keeps the cost low and allows the forced tool call that structured output needs. `temperature` is not sent, because current models reject non-default values with an error. (Before this fix every AI call failed and quietly fell back to the rules.)
- **Code:** `src/features/matching/nodes.ts` (`DEFAULT_MODEL`, `rank`)

### Agent type: a fixed LangGraph.js workflow, not a free-roaming agent
- **Date:** 2026-11-17
- **Decision:** The agent is a fixed graph with set steps: `prepare → shortlist → rank (one LLM call) → validate`, with a rules-based `fallback`. It is not a tool-using agent that decides its own steps.
- **Why:** The task is always the same, so a fixed path is predictable, cheap (exactly one model call) and easy to test. The rules always produce an answer, so the dashboard works even when the AI fails.
- **Why LangGraph.js specifically:** Reason not recorded.
- **Code:** `src/features/matching/graph.ts`, `nodes.ts`

### When the AI runs, and the fallback
- **Date:** 2026-11-17
- **Decision:** The existing fit rules score every open request and drop the ones the volunteer can't serve (no shared language or meeting mode). The top 25 go to the model (`SHORTLIST_SIZE`). The model returns up to 8 picks (`MAX_PICKS`). The model is skipped (rules only) when there are 8 or fewer candidates, no `ANTHROPIC_API_KEY`, or the model's answer fails validation.
- **Why:** Below 8 candidates there's nothing to rank, so the call would only cost money. Validation makes sure the model only returns real request ids.
- **Code:** `src/features/matching/nodes.ts` (`routeAfterShortlist`, `validate`, `fallback`), `prompt.ts`

### Privacy: only anonymous fields go to the model
- **Date:** 2026-11-17
- **Decision:** Only anonymous fields are sent to Claude: support types, meeting mode, city (only for in-person requests), language and days waiting, plus the volunteer's practical profile. No names, contact details or notes are sent. Requests are labelled `r1`, `r2`, … rather than by their database ids. The model returns only those labels and fixed fit tags, no free text.
- **Why:** The PII and no-medical-data rules in the PRD. With no free text in the output, there's nothing for the model to make up that a user could see.
- **Code:** `src/features/matching/nodes.ts` (`prepare`), `prompt.ts`

### Caching: 24 hours for AI, 3 minutes for rules
- **Date:** 2026-11-17
- **Decision:** Results are cached in memory per volunteer. The key changes when an open request changes, the volunteer edits their profile, or the day changes. AI results are kept 24h, rule results 3 min (so the AI gets retried soon).
- **Why:** This limits model calls (cost) without showing stale picks. A small `Map` is used instead of Next's `unstable_cache`, which can't choose a lifetime per result or share a call that's still running. On serverless hosts each instance has its own cache, which only means an occasional extra run.
- **Code:** `src/features/matching/getBestMatches.ts`

### Debugging: optional LangSmith tracing
- **Date:** 2026-11-17
- **Decision:** LangSmith tracing can be switched on with env vars while debugging. It's off by default.
- **Code:** `.env.example`

---

## 2. Product and safety rules

These come from `PRD.md` and are not negotiable.

### Volunteers support; they never represent
- **Decision:** Volunteers are not lawyers and hold no power of attorney. The UI says "support / accompany / assist", never "represent / claim / file for you".
- **Why:** Legal scope of the project (PRD §2).

### No medical documents on the platform
- **Decision:** No uploads of medical documents anywhere. Free-text fields (such as the volunteer checklist) carry a "no medical details" note.
- **Why:** PRD §2. The platform only matches and coordinates.

### Help-seeker identity hidden until a volunteer accepts
- **Date:** 2026-11-09
- **Decision:** Before accepting, volunteers see no last name, phone, email or note. Accepting is first come, first served, and limited to 3 active requests per volunteer. The database enforces both.
- **Why:** PRD §2 PII protection. The limit stops one volunteer from taking more than they can handle.
- **Code:** Supabase migrations, `src/features/requests/`

### Safe exit on every form step; progress not saved
- **Date:** 2026-11-09
- **Decision:** Every step of a form has a calm Exit button that asks once ("Leave the form? Your answers won't be saved.") and goes home.
- **Why:** Trauma-informed design (PRD §3). The PRD was updated to match.

### Volunteers write their own checklist
- **Date:** 2026-11-18
- **Decision:** The built-in checklist steps per support type were replaced. Each volunteer now writes their own steps for each request (up to 40 steps, 200 characters each). The list is cleared when a request changes hands.
- **Why:** Reason not recorded.
- **Code:** migration 0007, `save_request_checklist()`

### Request counts hidden on the open requests tabs
- **Date:** 2026-11-17
- **Decision:** Volunteers don't see how many requests each tab holds.
- **Why:** Reason not recorded.

---

## 3. Tech stack

### Next.js (App Router) + Tailwind CSS + React Hook Form + Lucide icons
- **Date:** 2026-11-09
- **Decision:** The stack listed in the PRD (§4), plus zod for validation, used on the client and again on the server with the same schema.

### Supabase for database and auth
- **Date:** 2026-11-09
- **Decision:** Supabase Postgres and Supabase Auth (email and password, cookie sessions via `@supabase/ssr`).
- **Details:** Tables are locked with row-level security (RLS). Volunteers act only through security-definer functions that check approval and ownership. The secret key is server-only.
- **Why Supabase specifically:** Reason not recorded.

---

## 4. Data and privacy

### Sensitive fields kept in separate, locked tables
- **Date:** 2026-11-09
- **Decision:** A help-seeker's last name, phone and email live in a separate table from the request itself. A volunteer's ID number, birth date and admin notes live in an admin-only table.
- **Why:** PII protection. Most queries never touch the sensitive data.

### No ID number collected from help-seekers; Israeli phone required
- **Date:** 2026-11-09
- **Decision:** The help form asks for an Israeli phone number, an optional email, and no ID number.
- **Why:** Collect as little as possible (zero-friction, PRD §3). Volunteers do give an ID number (with a check-digit test) for verification.

### Times handled in Israel time
- **Date:** 2026-11-14
- **Decision:** Meeting times and "today" are calculated in `Asia/Jerusalem`, whatever the server's time zone.

---

## 5. Language, design and accessibility

### Hebrew first, English second
- **Date:** 2026-11-09
- **Decision:** next-intl with `/he` (default, right-to-left) and `/en`. Layouts use start/end spacing so they mirror automatically.
- **Code:** `src/i18n/routing.ts`, `messages/`

### Language switcher stays in the top-right corner in both languages
- **Date:** 2026-11-19
- **Decision:** The rest of the header mirrors in Hebrew, but the EN | עב switcher always sits in the physical top-right corner.
- **Why:** So it doesn't jump out from under the cursor when you change language. Top-right (its English position) was picked over top-left.
- **Code:** `src/components/layout/SiteHeader.tsx`

### Light/dark mode: follow the device until the user picks
- **Date:** 2026-11-18 (fixed 2026-11-19)
- **Decision:** An iPhone-style switch in the header. Until it's used, the site follows the device setting. After that the choice is saved in this browser (localStorage, not the account).
- **Details:** A script in `<head>` applies the choice before the first paint, so there's no flash. Switching language makes React clear the setting, so the same script watches for that and restores it before paint. The accessibility settings work the same way.
- **Code:** `src/components/layout/theme.ts`, `ThemeSwitcher.tsx`, `src/components/a11y/preferences.ts`

### Calm colours; built-in accessibility panel
- **Date:** 2026-11-09
- **Decision:** Pastel greens, soft blues and warm off-white. No harsh reds, bright yellows or flashing. The accessibility panel (text size, high contrast, reduced motion) sits on the left edge in both languages.
- **Why:** Trauma-informed design (PRD §3).
