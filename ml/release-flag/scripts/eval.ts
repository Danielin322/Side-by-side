/**
 * Score the RAG classifier on dev or test, with the same code the site runs.
 *
 *   npm run flags:eval -- --split dev
 *   npm run flags:eval -- --split dev --k 6 --effort medium --model claude-sonnet-5-5
 *   npm run flags:eval -- --split test --final --runs 3
 *
 * Options: --k N (similar notes per label), --model, --effort low|medium|high, --concurrency N (default 4),
 * --limit N, --no-langsmith. Defaults come from src/features/releaseFlag/config.ts and the RELEASE_FLAG_* env.
 * Needs ANTHROPIC_API_KEY and AWS keys; with LANGSMITH_API_KEY each run is also a LangSmith experiment.
 * Writes ml/release-flag/results/runs/<date-time>-<prompt version>-<split>[-runN].json
 */

import type { EvaluatorT, SummaryEvaluatorT } from "langsmith/evaluation";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadConfig, type Effort, type FlagConfig, type FlagLabel } from "../../../src/features/releaseFlag/config";
import { classifyNote, FlagStageError, modelLabel, type FlagClients } from "../../../src/features/releaseFlag/core";
import { embedNotes } from "../../../src/features/releaseFlag/embed";
import { PROMPT_VERSION } from "../../../src/features/releaseFlag/prompt";
import { listKeys, type SimilarNote } from "../../../src/features/releaseFlag/vectors";
import { createClients, datasetVersion, fail, parseArgs, pool, readSplit, ROOT, type DatasetRow } from "./lib";

interface Scored extends DatasetRow {
  predicted: FlagLabel;
  knn: FlagLabel; // baseline without Claude: the label whose retrieved notes are closer on average
  outcome: "ok" | "refusal" | "invalid" | "error";
  evidence: string;
  reason_en: string;
  similar: Pick<SimilarNote, "id" | "label" | "distance" | "text">[];
}

interface Metrics { n: number; tp: number; fp: number; fn: number; tn: number; recall: number; precision: number; f1: number; accuracy: number }

const ratio = (a: number, b: number) => (b ? a / b : NaN);

function metrics(rows: { label: FlagLabel; predicted: FlagLabel }[]): Metrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const truth = r.label === "needs_attention", pred = r.predicted === "needs_attention";
    if (truth && pred) tp++; else if (!truth && pred) fp++; else if (truth) fn++; else tn++;
  }
  const recall = ratio(tp, tp + fn), precision = ratio(tp, tp + fp);
  const f1 = recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
  return { n: rows.length, tp, fp, fn, tn, recall, precision, f1, accuracy: ratio(tp + tn, rows.length) };
}

function knnVote(similar: SimilarNote[]): FlagLabel {
  const mean = (l: FlagLabel) => {
    const d = similar.filter((s) => s.label === l).map((s) => s.distance);
    return d.length ? d.reduce((a, b) => a + b, 0) / d.length : Infinity;
  };
  return mean("needs_attention") <= mean("ok") ? "needs_attention" : "ok";
}

async function scoreAll(clients: FlagClients, cfg: FlagConfig, rows: DatasetRow[], concurrency: number): Promise<Scored[]> {
  console.log("Embedding notes...");
  const vectors = await embedNotes(clients.bedrock, cfg.embedModel, rows.map((r) => r.text));
  let done = 0;
  return pool(rows, concurrency, async (row, i) => {
    let s: Scored;
    try {
      const r = await classifyNote(clients, cfg, { note: row.text, vector: vectors[i] });
      s = { ...row, predicted: r.label, knn: knnVote(r.similar), outcome: r.outcome, evidence: r.evidence, reason_en: r.reason_en, similar: r.similar };
    } catch (e) {
      // Same as the site: any failure becomes a needs_attention flag.
      const msg = e instanceof FlagStageError ? `[${e.stage}] ${e.message}` : String(e);
      s = { ...row, predicted: "needs_attention", knn: "needs_attention", outcome: "error", evidence: "", reason_en: msg, similar: [] };
    }
    if (++done % 20 === 0 || done === rows.length) process.stderr.write(`  ${done}/${rows.length}\n`);
    return s;
  });
}

const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${Math.round(x * 100)}%`);

function report(rows: Scored[]) {
  const all = metrics(rows);
  const knn = metrics(rows.map((r) => ({ label: r.label, predicted: r.knn })));
  console.log("\n                    true needs_attention   true ok");
  console.log(`predicted needs_att ${String(all.tp).padStart(20)}${String(all.fp).padStart(10)}`);
  console.log(`predicted ok        ${String(all.fn).padStart(20)}${String(all.tn).padStart(10)}`);

  console.log("\nneeds_attention:    recall  precision     F1   rows");
  const line = (name: string, m: Metrics) =>
    console.log(`  ${name.padEnd(17)}${pct(m.recall).padStart(6)}${pct(m.precision).padStart(11)}${pct(m.f1).padStart(7)}${String(m.n).padStart(7)}`);
  line("RAG + Claude", all);
  line("kNN baseline", knn);
  const groups: Record<string, Metrics> = {};
  for (const key of ["language", "source"] as const) {
    for (const v of [...new Set(rows.map((r) => r[key]))].sort()) {
      groups[`${key}:${v}`] = metrics(rows.filter((r) => r[key] === v));
      line(`${key} ${v}`, groups[`${key}:${v}`]);
    }
  }

  const failures = rows.filter((r) => r.outcome !== "ok");
  if (failures.length) {
    console.log(`\n${failures.length} note(s) got no answer and became fail-safe needs_attention:`);
    for (const f of failures.slice(0, 10)) console.log(`  ${f.id} [${f.outcome}] ${f.reason_en.slice(0, 200)}`);
  }

  const mistakes = rows.filter((r) => r.label !== r.predicted).sort((a, b) => (a.label === "needs_attention" ? -1 : 1) - (b.label === "needs_attention" ? -1 : 1) || a.id.localeCompare(b.id));
  console.log(`\nMistakes (${mistakes.length}), missed needs_attention first:`);
  for (const m of mistakes) {
    console.log(`  ${m.id} [${m.language}/${m.source}] true ${m.label} -> predicted ${m.predicted}`);
    console.log(`     note: ${m.text.replace(/\s+/g, " ").slice(0, 200)}`);
    if (m.reason_en) console.log(`     why:  ${m.reason_en.slice(0, 200)}`);
    for (const e of m.similar.slice(0, 4)) console.log(`     ~ ${(1 - e.distance).toFixed(2)} ${e.label.padEnd(15)} ${e.id}: ${e.text.replace(/\s+/g, " ").slice(0, 90)}`);
  }

  const he = groups["language:he"];
  const sourceF1 = Object.entries(groups).filter(([k]) => k.startsWith("source:")).map(([, m]) => m.f1).filter((x) => !Number.isNaN(x));
  const spread = sourceF1.length > 1 ? Math.max(...sourceF1) - Math.min(...sourceF1) : 0;
  const check = (ok: boolean, text: string) => console.log(`  ${ok ? "PASS" : "FAIL"}  ${text}`);
  console.log("\nTargets:");
  check(all.recall >= 0.95, `needs_attention recall >= 95% overall (${pct(all.recall)})`);
  check(!he || Number.isNaN(he.recall) || he.recall >= 0.95, `needs_attention recall >= 95% in Hebrew (${he ? pct(he.recall) : "no Hebrew rows"})`);
  check(all.precision >= 0.7, `precision >= 70% (${pct(all.precision)})`);
  check(all.f1 >= 0.85, `F1 >= 0.85 (${all.f1.toFixed(2)})`);
  check(spread <= 0.1, `F1 per source within 10 points (spread ${Math.round(spread * 100)})`);
  return { all, knn, groups };
}

async function logToLangSmith(split: string, version: string, rows: Scored[], meta: Record<string, unknown>, runLabel: string) {
  const { Client } = await import("langsmith");
  const { evaluate } = await import("langsmith/evaluation");
  const client = new Client();
  const datasetName = `release-flag-rag-${split}-${version}`;
  if (!(await client.hasDataset({ datasetName }))) {
    const ds = await client.createDataset(datasetName, { description: `Release-note flags, ${split} split (made-up notes only)` });
    await client.createExamples(rows.map((r) => ({
      dataset_id: ds.id,
      inputs: { id: r.id, note: r.text, language: r.language, source: r.source },
      reference_outputs: { label: r.label },
      metadata: { language: r.language, source: r.source, label: r.label },
    })));
    console.log(`LangSmith: created dataset ${datasetName}`);
  }
  // The notes were already classified, so the target looks up the answer: no second API call.
  type KV = Record<string, unknown>;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const target = (inputs: KV): KV => {
    const r = byId.get(String(inputs.id))!;
    return { label: r.predicted, knn: r.knn, evidence: r.evidence, reason_en: r.reason_en, outcome: r.outcome, examples: r.similar.map((e) => ({ id: e.id, label: e.label, similarity: 1 - e.distance })) };
  };
  const evaluators: EvaluatorT[] = [
    ({ outputs, referenceOutputs }: { outputs: KV; referenceOutputs?: KV }) => ({ key: "correct", score: outputs.label === referenceOutputs?.label ? 1 : 0 }),
    ({ outputs, referenceOutputs }: { outputs: KV; referenceOutputs?: KV }) =>
      ({ key: "missed_needs_attention", score: referenceOutputs?.label === "needs_attention" && outputs.label !== "needs_attention" ? 1 : 0 }),
  ];
  const summaryEvaluators: SummaryEvaluatorT[] = [
    ({ outputs, referenceOutputs }: { outputs: KV[]; referenceOutputs?: KV[] }) => {
      const m = metrics(outputs.map((o, i) => ({ label: referenceOutputs![i].label as FlagLabel, predicted: o.label as FlagLabel })));
      return [{ key: "recall", score: m.recall }, { key: "precision", score: m.precision }, { key: "f1", score: m.f1 }];
    },
  ];
  const results = await evaluate(target, { data: datasetName, experimentPrefix: `${PROMPT_VERSION}-${split}${runLabel}`, metadata: meta, maxConcurrency: 8, evaluators, summaryEvaluators });
  console.log(`LangSmith: experiment ${results.experimentName}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const split = typeof args.split === "string" ? args.split : "dev";
  if (split !== "dev" && split !== "test") throw new Error("--split must be dev or test");
  if (split === "test" && !args.final) throw new Error("Test is the frozen final check. Add --final if you really mean to score it now.");

  const base = loadConfig();
  const cfg: FlagConfig = {
    ...base,
    topK: args.k ? Number(args.k) : base.topK,
    model: typeof args.model === "string" ? args.model : base.model,
    effort: typeof args.effort === "string" ? (args.effort as Effort) : base.effort,
  };
  const all = readSplit(split);
  const rows = args.limit ? all.slice(0, Number(args.limit)) : all;
  const version = datasetVersion();
  const na = rows.filter((r) => r.label === "needs_attention").length;
  console.log(`${split} (${version}): ${rows.length} notes (needs_attention ${na}, ok ${rows.length - na})`);
  console.log(`Prompt ${PROMPT_VERSION}, model ${cfg.model}, effort ${cfg.effort}, k ${cfg.topK} per label, index ${cfg.index}`);

  const clients = createClients(cfg);
  // A note must never find itself: refuse to run if any eval note is in the index.
  const inIndex = new Set(await listKeys(clients.vectors, cfg).catch((e) => { throw new Error(`Can't read the index ${cfg.index}: ${e instanceof Error ? e.message : e}`); }));
  if (!inIndex.size) throw new Error(`Index ${cfg.index} is empty. Run npm run flags:ingest first.`);
  const leaked = rows.filter((r) => inIndex.has(r.id)).map((r) => r.id);
  if (leaked.length) throw new Error(`${leaked.length} ${split} note(s) are in the index (${leaked.slice(0, 5).join(", ")}). Run npm run flags:ingest to clean it.`);

  const useLangSmith = !args["no-langsmith"] && !!process.env.LANGSMITH_API_KEY;
  if (!useLangSmith && !args["no-langsmith"]) console.log("(LANGSMITH_API_KEY not set: results are saved locally only)");
  const outDir = join(ROOT, "results", "runs");
  mkdirSync(outDir, { recursive: true });
  const runs = Number(args.runs ?? 1);

  for (let run = 1; run <= runs; run++) {
    const runLabel = runs > 1 ? `-run${run}` : "";
    console.log(`\n=== Run ${run}/${runs} ===`);
    const scored = await scoreAll(clients, cfg, rows, Number(args.concurrency ?? 4));
    const result = report(scored);
    const meta = { prompt_version: PROMPT_VERSION, model: modelLabel(cfg), effort: cfg.effort, k: cfg.topK, index: cfg.index, split, dataset_version: version };
    const file = join(outDir, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${PROMPT_VERSION}-${split}${runLabel}.json`);
    writeFileSync(file, JSON.stringify({ ...meta, ...result, rows: scored }, null, 2) + "\n");
    console.log(`\nSaved ${file}`);
    if (useLangSmith) await logToLangSmith(split, version, scored, meta, runLabel);
  }
}

main().catch(fail);
