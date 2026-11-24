# Prompt for drafting notes with ChatGPT and Gemini

Use this to draft 100 rows with ChatGPT and 100 with Gemini. Every draft is only a suggestion: you read each row,
set `label` yourself using `labeling-guide.md`, fix or delete bad rows, and only then add it to `labeled.csv`.

**How to use it**
1. Start a new chat. Attach `labeling-guide.md`, or paste its contents where it says `[LABELING GUIDE]`.
2. Change the two `[SOURCE]` / `[PREFIX]` values: `chatgpt` / `gpt` for ChatGPT, `gemini` / `gem` for Gemini.
3. Paste **message 1** and copy the CSV block it returns.
4. Paste **message 2** in the same chat and copy the second CSV block.
5. Check the count line under each block. If a batch came out short, ask the model to "add the missing rows, continuing the ids".
6. Paste both blocks into the sheet. The second block's header row is a duplicate, so delete it.

If a model refuses or softens the sexual or self-harm rows, write those rows by hand. They count toward your
`manual` 100.

---

## Message 1 (rows 1–50)

```text
You are helping build a test dataset for a text classifier at an Israeli non-profit. Volunteers help people with
mental-health challenges deal with government offices (Bituach Leumi, municipality, health fund, forms, phone calls,
appointments). When a volunteer hands a case back, they can write a short note to the team. The classifier reads that note and
gives it one label: ok (no action needed) or needs_attention (an admin must review it). The rules are in the
labeling guide below. Follow it exactly.

[LABELING GUIDE]

Write 50 made-up release notes. Everything is fictional: invent first names if you need any.

Exact counts for this batch:
- Hebrew (language = he): 16 ok, 24 needs_attention  (40 rows)
- English (language = en): 4 ok, 6 needs_attention    (10 rows)
- Spread needs_attention over both kinds: behaviour toward the volunteer (yelling, won't cooperate, asks for money)
  and safety (touching, sexual remarks, threats, the requester at risk).
- About a third of the "ok" rows must be HARD NEGATIVES: notes that sound alarming but are ok under the guide
  (kids yelling in the background, the volunteer's own rough week, a call that went badly for practical reasons,
  a requester who was sad but not at risk).
- Include borderline rows that test the tie-break rules (understatement, sarcasm, a volunteer playing down something
  physical, a threat that sounds like a joke).

How the notes must read:
- First person, as a volunteer types into a small text box: usually 1–3 sentences, at most ~400 characters.
- Vary a lot: short and long, formal and casual, typos and missing punctuation, slang, indirect hints, sarcasm,
  a few Hebrew notes with some English words mixed in. No two notes should read like rewrites of each other.
- Hebrew: natural Israeli Hebrew as people really write it, never translated from English.
- English: written by an English-speaking volunteer in Israel in their own words, with natural English phrasing.
- Keep safety rows clear but not graphic.
- Every row is a different situation.

Output format: ONE ```csv code block and nothing else inside it. Use exactly these columns, in this order:
id,language,text,suggested_label,source,group_id
- id: [PREFIX]-001 to [PREFIX]-050
- language: he or en
- text: the note
- suggested_label: ok or needs_attention (your suggestion; a person checks it)
- source: [SOURCE]
- group_id: leave empty
Use standard CSV quoting: put a field in double quotes if it contains a comma, a double quote or a line break, and
write any double quote inside a field as two double quotes (""). Do not number lines or add comments inside the block.

After the code block, write one line with the counts you produced, in this form:
he: ok X, needs_attention X | en: ok X, needs_attention X
```

## Message 2 (rows 51–100)

```text
Continue with 50 more rows, ids [PREFIX]-051 to [PREFIX]-100. Same rules, same columns, same quoting, one ```csv
code block with the header row.

Exact counts for this batch:
- Hebrew: 16 ok, 24 needs_attention  (40 rows)
- English: 4 ok, 6 needs_attention    (10 rows)
- Again about a third of the "ok" rows are hard negatives, plus some borderline rows.

Do not reuse any situation, wording or name pattern from rows 1–50. Pick new offices, new problems and new ways of
saying things. Pay the same attention to the last rows as the first ones.

After the code block, write the count line again in the same form.
```

---

**Totals per source after both messages:** 100 rows: 80 Hebrew (32 ok, 48 needs_attention) and 20 English (8 ok,
12 needs_attention).
Use the same numbers when you write your own 100 (`source` = `manual`). You can leave `id` empty for your rows:
`dataset.ts` numbers them `man-001`, `man-002`…

**Into the sheet:** paste the rows into `labeled.csv` (columns `id, language, text, suggested_label, label, source,
group_id`) and fill `label` yourself.
