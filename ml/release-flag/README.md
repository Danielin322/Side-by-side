# Release-note flags (RAG)

Each note a volunteer writes when handing a case back is labeled `ok` or `needs_attention`. To decide, we embed the
whole note (Cohere Embed Multilingual on Amazon Bedrock), fetch the most similar notes **you** labeled from AWS S3
Vectors (the top k from each label), and give them to Claude Haiku as examples. `needs_attention` notes show up for
admins in Needs attention.
Why it's built this way: [docs/decision-page.md](../../docs/decision-page.md), section "Release-note flags".

Every note in this folder is **made up**. Real notes from the site are never stored here or in S3 Vectors.

## The steps, in order

| # | Step | Command | Done when |
|---|---|---|---|
| 1 | AWS setup (once) | see "AWS setup" below | keys in `.env.local` |
| 2 | Draft and label ~300 notes | [data/generation-prompt.md](data/generation-prompt.md), then label in a sheet | `data/labeled.csv` exists |
| 3 | Check + split | `npm run flags:dataset` | index / dev / test written |
| 4 | Create the index (once) | `npm run flags:setup` | bucket and index exist |
| 5 | Fill the index | `npm run flags:ingest` | index split is in S3 Vectors |
| 6 | Tune on dev | `npm run flags:eval -- --split dev` | dev targets met |
| 7 | Final test | `npm run flags:eval -- --split test --final --runs 3` | targets met on all 3 runs |

Run every command from the repo root. Keys are read from `.env.local` (which git ignores) or from your shell.

## AWS setup (once)

1. **Region:** use `eu-central-1` (Frankfurt, next to the site and the database).
   - On a free-plan account Frankfurt may be unavailable: *Billing → upgrade / activate advanced features*.
   - In an AWS Organization, a region-restriction policy (SCP) can block it ("explicit deny"). Add `eu-central-1` to
     that policy in the management account, and to *Account settings → Visible regions* in the console.
   - Then check that *S3 → Vector buckets* and *Bedrock → Model catalog → Cohere Embed Multilingual* both open there.
2. **Model access:** there's no "Model access" page any more. Cohere is a Marketplace model: it's switched on for the
   account by the first successful call from a user who may subscribe to Marketplace products. Step 3 gives the IAM
   user that permission for the first call only (the `TemporaryEnableCohere` block).
3. **IAM user:** *IAM → Users → Create user* `release-flag`, with no console access. Attach this inline policy, with
   `ACCOUNT_ID` and the region filled in. It allows only this one bucket and this one model, plus the Marketplace
   permission for the first call (removed in step 7):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3vectors:CreateVectorBucket", "s3vectors:CreateIndex", "s3vectors:GetIndex",
           "s3vectors:PutVectors", "s3vectors:GetVectors", "s3vectors:QueryVectors",
           "s3vectors:ListVectors", "s3vectors:DeleteVectors"
         ],
         "Resource": [
           "arn:aws:s3vectors:eu-central-1:ACCOUNT_ID:bucket/side-by-side-release-flags",
           "arn:aws:s3vectors:eu-central-1:ACCOUNT_ID:bucket/side-by-side-release-flags/*"
         ]
       },
       {
         "Effect": "Allow",
         "Action": "bedrock:InvokeModel",
         "Resource": "arn:aws:bedrock:eu-central-1::foundation-model/cohere.embed-multilingual-v3"
       },
       {
         "Sid": "TemporaryEnableCohere",
         "Effect": "Allow",
         "Action": ["aws-marketplace:Subscribe", "aws-marketplace:ViewSubscriptions"],
         "Resource": "*"
       }
     ]
   }
   ```

4. **Access key:** open the user → *Security credentials → Create access key* → "Application running outside AWS".
5. **Put the keys in `.env.local`** (and later in Vercel, see "On the site" below):

   ```
   AWS_REGION=eu-central-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ANTHROPIC_API_KEY=...
   LANGSMITH_API_KEY=...        # optional, for LangSmith experiments
   ```

   Optional overrides, with their defaults in `src/features/releaseFlag/config.ts`: `RELEASE_FLAG_VECTOR_BUCKET`,
   `RELEASE_FLAG_VECTOR_INDEX`, `RELEASE_FLAG_EMBED_MODEL`, `RELEASE_FLAG_MODEL`, `RELEASE_FLAG_TOP_K`,
   `RELEASE_FLAG_EFFORT`.

6. **First call:** `npm run flags:setup` (creates the bucket and index), then `npm run flags:ingest -- --dry-run` and
   `npm run flags:ingest`. The ingest is the first Bedrock call, which switches Cohere on. On a new account you may
   get, in this order:
   - `AccessDeniedException: Your account is currently being verified`: wait (usually under 2 hours, can be a day).
   - `ValidationException: Operation not allowed`: the account has a Bedrock restriction that only AWS can lift.
     Open *Support Center → Create case → Account and billing* (free on every plan), say that Bedrock InvokeModel
     returns this error for `cohere.embed-multilingual-v3` in `eu-central-1` although IAM allows it, and ask them to
     enable Bedrock for the account. Chat is the fastest.
   - The "Submit use case details for Anthropic" form in the Bedrock console is only for Claude on Bedrock. We call
     Claude through the Anthropic API, so skip it.
7. **Remove the temporary permission** once ingest works: delete the `TemporaryEnableCohere` block and the comma
   before it, then *Save changes*. The key keeps only the bucket and the model.

One user for both building the index and the site keeps this simple. The cost is that the site's key could also
write to the index, which is fine while the index holds only made-up notes (see the decision page).

## On the site

1. **Database:** run `supabase/migrations/0010_release_flags.sql` and `0011_release_flags_grants.sql` in the Supabase
   SQL Editor of **every** project the app uses: the production project (the one in Vercel's `SUPABASE_URL`) before
   the deploy, and the local one in `.env.local`. Check the project id in the URL before you run anything.
2. **Vercel** (*Settings → Environment Variables*): `RELEASE_FLAG_ENABLED=true` and `AWS_REGION` (plain), plus
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `ANTHROPIC_API_KEY` (marked Sensitive), for Production. For
   Preview, see the note on preview links below. `LANGSMITH_*` is only for the eval scripts.
3. **Check:** hand back a test case with a note, wait ~10 s, then look at Needs attention and `/admin/logs` →
   event log → Note flags. A failed check shows `release_flag.failed` with the stage and error, and still flags the note.

**Preview links:** a preview deployment uses the Preview variables. If Preview has `RELEASE_FLAG_ENABLED=true` and
the same `SUPABASE_URL` as production, test hand-backs on a preview create real flags in the production database.
Leave `RELEASE_FLAG_ENABLED` unset (off) for Preview unless Preview has its own database.

## Building the dataset

**The mix**, for each source of 100 rows: 80 Hebrew (32 `ok`, 48 `needs_attention`) and 20 English (8 `ok`, 12
`needs_attention`). About a third of the `ok` rows should be **hard negatives**: notes that sound bad but aren't
(kids yelling in the background, the volunteer's own rough week). [data/generation-prompt.md](data/generation-prompt.md)
has the messages to paste into ChatGPT and Gemini. Write your own 100 with `source` = `manual`.

**The sheet** `data/labeled.csv` (see [labeled.template.csv](data/labeled.template.csv)):

| Column | Required | What |
|---|---|---|
| `id` | filled in for you | leave empty on new rows: `flags:dataset` numbers them `gpt-…`, `gem-…`, `man-…` |
| `language` | yes | `he` or `en`, by the note's main language |
| `text` | yes | the note, up to 1000 characters |
| `suggested_label` | no | what the drafting model suggested; ignored by the scripts |
| `label` | yes | `ok` or `needs_attention`: **your** label, by [labeling-guide.md](labeling-guide.md) |
| `source` | yes | `chatgpt`, `gemini` or `manual` |
| `group_id` | filled in for you | the same value on notes about the same situation keeps them in one split; empty = its own group |

Save the sheet as CSV (UTF-8), then:

```bash
npm run flags:dataset -- --check
```

This fills in empty `id` / `group_id` values and writes them back to `labeled.csv`, after saving a copy as
`labeled.csv.bak`. Existing ids never change. It then lists broken rows (wrong number of columns, bad label,
duplicate id), near-duplicate notes, and counts per source, language and label. When it's clean:

```bash
npm run flags:dataset
```

| Split | Share | Used for |
|---|---|---|
| `index` | ~50% | Stored in S3 Vectors: the examples Claude gets shown |
| `dev` | ~20% | Scored after each change (k, prompt, model); you study its mistakes |
| `test` | ~30% | **Frozen.** Scored only for the final check |

Dev and test notes are never in the index. `flags:ingest` removes any vector that isn't in the index split, and
`flags:eval` refuses to run if a dev/test note is found in the index. Re-running `flags:dataset` after adding rows
keeps every existing row in its split. `--reset` starts over: then use a new `RELEASE_FLAG_VECTOR_INDEX` name.

**After the final test**, if you changed rules or labels because of its mistakes, the test set has been seen and can't
measure unseen notes anymore. Write new notes (without reading the old test notes), add them to `labeled.csv`, and run
`npm run flags:dataset -- --retire-test`: the old test rows join the index as examples, the new rows become the test
set, then run `flags:ingest`.

If you'd rather not write new notes, `npm run flags:dataset -- --resplit --to-index <ids>` keeps dev as it is and
splits every other row again into index and test. List in `--to-index` every note whose mistake you studied to change
a rule or label, so it never lands in test. Then run `flags:ingest`.

## Tuning and testing

```bash
npm run flags:eval -- --split dev
```

| Option | What |
|---|---|
| `--k 6` | similar notes per label (default 4) |
| `--effort medium` | more thinking for Claude (default low) |
| `--model claude-sonnet-5-5` | a bigger model |
| `--limit 20` | only the first 20 notes, for a quick try |
| `--no-langsmith` | don't log to LangSmith |

Each run prints:
- the confusion table;
- recall, precision and F1 for `needs_attention`, overall and per language and source;
- a **kNN baseline**, which picks the label whose retrieved notes are closer on average, with no Claude. If Claude
  doesn't beat it, the prompt isn't adding anything;
- every mistake, with the notes that were retrieved for it;
- PASS/FAIL for each target.

It saves everything in `results/runs/`. With `LANGSMITH_API_KEY` set, it also logs the run as an experiment, so you
can compare versions and open each mistake.

**The loop:**
1. Run the baseline at k = 4 and note the numbers.
2. Try k = 2, 6, 8.
3. Read the mistakes. If the retrieved examples were wrong or missing, add labeled rows like them to the index
   (re-run `flags:dataset` and `flags:ingest`). If the rule was unclear, add a rule to the prompt
   (`src/features/releaseFlag/prompt.ts`, bump `PROMPT_VERSION`) **and** to `labeling-guide.md`.
4. If it's still short, try `--effort medium`, then `--model claude-sonnet-5-5`.
5. Never move a dev or test note into the index by hand.

**Targets:**
- `needs_attention` recall ≥ 95% overall **and** in Hebrew.
- Precision ≥ 70%.
- F1 ≥ 0.85.
- F1 per source within 10 points of each other.

English is about 20% of the data, so its numbers are rough.

## Code

```
src/features/releaseFlag/   config.ts (settings), embed.ts (Bedrock), vectors.ts (S3 Vectors),
                            prompt.ts (rules + examples), core.ts (embed -> retrieve -> Claude)
ml/release-flag/scripts/    dataset.ts, setup-index.ts, ingest.ts, eval.ts, lib.ts
ml/release-flag/data/       labeled.csv (you create it), splits/, generation-prompt.md, agreement/ (old raw notes)
ml/release-flag/results/    one JSON file per eval run
```

The site uses the same `core.ts`, so dev and test scores describe what runs in production.
