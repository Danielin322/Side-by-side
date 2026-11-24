# Labeling guide: release-note flags

When a volunteer hands a case back, they can write a short note. Each note gets **one** label: `ok` or
`needs_attention`. This guide is the rulebook. When you change your mind about a kind of note, add the decision here
as a new rule, so every note like it gets the same label. Claude reads these same rules when it classifies a note.

Label the **note text only**. Don't guess at things the note doesn't say.

## The two labels

### `ok`: no action needed
A normal hand-back. Nothing in the note needs an admin.
- The volunteer's own time, health, work, family, or moving away.
- A practical mismatch: the volunteer doesn't speak the requester's language, distance, meeting format, skills, a
  better fit elsewhere.
- The requester found help somewhere else, or the need is solved.
- Ordinary difficulty: hard to schedule, slow progress, a call that went badly *for practical reasons*.

| Language | Example |
|---|---|
| EN | "I started a new job and can't keep the weekly meetings, sorry." |
| EN | "She'd be better off with someone who speaks Russian." |
| EN | "The kids were yelling in the background the whole call so we didn't get much done." (yelling, but not *at* the volunteer) |
| HE | "אין לי זמן החודש, מקווה שמישהו אחר יוכל לעזור לו." |
| HE | "הוא מצא עזרה דרך העובדת הסוציאלית, אז כבר לא צריך אותי." |
| HE | "גרה רחוק מדי בשבילי, עדיף מתנדב מהאזור." |

### `needs_attention`: an admin should review and handle it
Anything about how the requester behaved toward the volunteer, the requester's safety, or the case that an admin
should act on: contact the requester or volunteer, change or close the request, or report it.

**Behaviour toward the volunteer:**
- Yelling at or insulting the volunteer, aggressive words.
- Refusing to cooperate: won't share documents, ignores agreed steps, walks out, repeated no-shows.
- Asking for things outside the role: money, loans, rides everywhere, "just sign for me", acting as their lawyer.
- Pressure that makes the volunteer uneasy, or the volunteer says they feel uncomfortable, even without saying why.

**Safety:**
- Any unwanted physical contact or sexual behaviour: touching, comments, messages, invitations, pictures.
- Threats of any kind, toward the volunteer or anyone else.
- Violence or damage to property, or the volunteer felt physically unsafe.
- The requester seems at risk: talk of not wanting to live, self-harm, being abused at home, not eating, no place
  to sleep tonight.
- Following or stalking the volunteer, showing up at their home or work uninvited.

| Language | Example |
|---|---|
| EN | "He kept yelling at me every time I asked for a document." |
| EN | "Three meetings in a row she didn't show up or answer the phone." |
| EN | "He touched my leg twice during the meeting and I felt really uncomfortable." |
| EN | "She told me she doesn't see a point in living anymore. I don't feel equipped for this." |
| HE | "היא מסרבת לשתף פעולה, לא מביאה שום מסמך ולא עונה להודעות." |
| HE | "ביקש שאחתום במקומו על הטפסים ונעלב כשסירבתי." |
| HE | "הוא נגע לי בכתף ולא הפסיק גם כשביקשתי, הרגשתי מאוד לא בנוח." |
| HE | "אמרה שאין לה בשביל מה לחיות ושהיא לא אוכלת כבר כמה ימים." |

## Rules for close calls
1. **When unsure, choose `needs_attention`.** A missed note costs far more than an admin reading one that's fine.
2. **Anything physical or sexual is `needs_attention`**, even if the volunteer plays it down ("probably nothing, but
   he hugged me and didn't let go").
3. **A threat is `needs_attention`** even when it sounds like a joke.
4. **The requester at risk is `needs_attention`**, even if the volunteer was calm about it.
5. **A rude remark aimed at the volunteer is `needs_attention`**, even alongside a practical reason ("he was rude,
   and anyway it's not a good fit").
6. **Yelling that isn't aimed at the volunteer is `ok`** (kids, TV, an argument with someone else on the phone).
7. **The volunteer's own hard feelings** ("this case was emotionally hard for me") are `ok`, unless the note says
   what the requester did. Then the label follows what they did. A meeting that went so badly the volunteer drops
   the case is `needs_attention` (rule 14).
8. **Sarcasm and understatement count by meaning** ("lovely meeting, he only screamed at me twice" is
   `needs_attention`).
9. **Empty notes, or notes that only repeat the reason** ("availability") are `ok`.
10. **Mixed Hebrew and English**: label by meaning. The `language` field is the main language of the note.
11. (2026-11-24) **An unsafe or unlivable home is `needs_attention`**: pests, hoarding, filth or a strong stench that
    keep the volunteer from working there ("there are spiders everywhere, I can't help like this"). A personal limit
    of the volunteer alone, such as an allergy to the requester's cats, is `ok`. (2026-11-24) The requester's own poor
    hygiene or body odor, with nothing wrong with the home, is also `ok`: this rule is about the home, not the person.
12. (2026-11-24) **Lying or misusing the service is `needs_attention`**: the requester misleads to get more help, for
    example hiding that another organization already helps so that more volunteers come. (2026-11-24) So is a
    requester who seems able to do it alone and uses the volunteer only because it's easier ("he's completely capable
    of doing all this himself, it's just easier for him").
13. (2026-11-24) **Trouble communicating is `needs_attention`**, in any language: unclear speech, hard to understand
    or follow, can't express what they need ("he speaks unclearly and I can't understand what he says"). Only a plain
    language mismatch, where the requester speaks well in a language the volunteer doesn't know, is `ok`.
14. (2026-11-24) **A meeting so bad the volunteer drops the case is `needs_attention`**, even without details
    ("after the last meeting went so badly, I'm not continuing").
15. (2026-11-24) **Insisting after a clear "no" is `needs_attention`**, even if the requester stays polite: for
    example insisting on benefits they were found not to be entitled to, or on something the volunteer can't do.

## Sheet columns
`id, language, text, label, source, group_id` (`suggested_label` is optional and ignored). You can leave `id` and `group_id` empty: `dataset.ts`
fills them in. See `README.md`.

## Changes
Add new rules at the end of the list with the date, e.g. `11. (2026-12-02) ...`.
