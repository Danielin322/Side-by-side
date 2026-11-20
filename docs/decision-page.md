# Decision page

The important choices made while building Side by Side: what we picked, why, and what we didn't pick.
Use it to answer "why is it done this way?".

New decisions go at the top of their section. Each entry has the decision and the reason. Where the reason was
never written down, the entry says **Reason not recorded**. Fill those in when you can.

**Contents**

1. [Best matches (matching rules)](#1-best-matches-matching-rules)
2. [Tech stack](#2-tech-stack)
3. [Data and privacy](#3-data-and-privacy)

---

## 1. Best matches (matching rules)

The "Best matches" tab on the volunteer dashboard. It picks the open requests that best fit a volunteer.

### No AI: plain scoring rules with city distances
- **Decision:** Best matches come from a fixed scoring rule, not an AI model. The earlier AI agent (Claude Haiku via
  LangGraph.js, with LangSmith tracing) was removed, along with its API key, cache and fallback path.
- **Why:** The AI only ever saw a handful of structured fields (language, meeting type, city, support types, transport,
  days waiting). Ranking those is a weighted score, and the one thing the AI knew that the rules didn't, which cities
  are near each other, is solved by a distance table. Rules are free, instant, give the same answer every time, are
  easy to test and explain, and send no request data outside our server.
- **When to reconsider:** If matching ever needs to read free text (like a description of the request), an AI could
  add something the rules can't.

### How the score works
- **Decision:** Shared language +6 (or +4 at "basic" level). Meeting format the volunteer offers +2. For in-person
  requests: same city +3, or nearby +2. Each matching support type +2. Ties go to whoever has waited longest. Best
  matches shows the top 8 requests where the volunteer shares the language and offers the meeting format. The same
  score orders the "All requests" tab.
- **Nearby:** Within 15 km in a straight line, or 30 km if the volunteer has a car.
- **Why:** These are the same priorities the AI was told to follow, written as numbers.

### City distances: a built-in list of Israeli towns
- **Decision:** About 110 Israeli cities and towns with approximate coordinates, Hebrew and English names and common
  spellings, are kept in the code. Distance is the straight line between town centres. A town not in the list can
  still match by exact name, but gets no "nearby".
- **Why:** City is typed as free text, so names must match in both languages and several spellings. Straight-line
  distance is good enough for 15 / 30 km buckets; road distance only matters in a few edge cases. A small list in the
  code needs no outside service.

---

## 2. Tech stack

### Supabase for database and login
- **Decision:** Supabase stores the data and handles login (email and password).
- **Details:** Database access is locked down so each user can only reach what they're allowed to. Volunteers can only make changes through approved actions that check they're verified and that the request is theirs. The secret key is used on the server only.
- **Why Supabase specifically:** Reason not recorded.

---

## 3. Data and privacy

### Sensitive details kept in separate, locked tables
- **Decision:** A help-seeker's last name, phone and email are stored separately from the request itself. A volunteer's ID number, birth date and admin notes are stored where only admins can see them.
- **Why:** Privacy. Most of the app never touches the sensitive details.
