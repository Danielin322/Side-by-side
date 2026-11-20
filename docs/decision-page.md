# Decision page

The important choices made while building Side by Side: what we picked, why, and what we didn't pick.
Use it to answer "why is it done this way?".

New decisions go at the top of their section. Each entry has the decision and the reason. Where the reason was
never written down, the entry says **Reason not recorded**. Fill those in when you can.

**Contents**

1. [Best match agent (AI)](#1-best-match-agent-ai)
2. [Tech stack](#2-tech-stack)
3. [Data and privacy](#3-data-and-privacy)

---

## 1. Best match agent (AI)

The "Best matches" tab on the volunteer dashboard. It picks the open requests that best fit a volunteer.

### Model: Claude Haiku 5.5
- **Decision:** Ranking uses Claude Haiku 5.5 by default. A setting can switch to another Claude model without changing the code.
- **Why:** Ranking a short list of requests is a simple task. Haiku is the cheapest and fastest Claude model and is good enough for it.
- **Details:** Haiku's "thinking" mode is turned off. That keeps the cost low and lets the model reply in the fixed format we need.

### Agent type: a fixed workflow (LangGraph.js), not a free-roaming agent
- **Decision:** The agent always follows the same steps: prepare the data, shortlist requests, ask the AI to rank them (one call), and check the answer. If anything goes wrong, a set of simple rules picks the matches instead. It is not an agent that decides its own steps.
- **Why:** The task is always the same, so a fixed path is predictable, cheap (exactly one AI call) and easy to test. The rules always produce an answer, so the dashboard works even when the AI fails.
- **Why LangGraph.js specifically:** Reason not recorded.

### When the AI runs, and the fallback
- **Decision:** The existing matching rules score every open request and drop the ones the volunteer can't serve (no shared language or meeting type). The top 25 go to the AI, which picks up to 8. The AI is skipped and the rules decide alone when there are 8 or fewer requests, when no AI key is set up, or when the AI's answer doesn't pass the check.
- **Why:** With 8 or fewer requests there's nothing to rank, so an AI call would only cost money. The check makes sure the AI only returns requests that really exist.

### Privacy: only anonymous details go to the AI
- **Decision:** The AI sees only anonymous details: type of help needed, meeting type, city (only for in-person meetings), language and how long the request has waited, plus the volunteer's practical profile. No names, contact details or personal notes are sent. The AI answers only with which requests fit and why, from a fixed list of reasons, never free text.
- **Why:** The privacy and no-medical-data rules in the PRD. With no free text in the answer, the AI can't make up anything a user would see.

### Caching: 24 hours for AI results, 3 minutes for rule results
- **Decision:** Each volunteer's matches are saved and reused instead of asking the AI every time. They are recalculated when an open request changes, the volunteer edits their profile, or a new day starts. AI results are kept for 24 hours. Rule results are kept for only 3 minutes, so the AI gets another try soon.
- **Why:** This keeps AI costs down without showing out-of-date matches.

### Debugging: optional tracing
- **Decision:** Each AI run can be recorded in LangSmith (a tool for inspecting AI runs) while debugging. It's off by default.

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
