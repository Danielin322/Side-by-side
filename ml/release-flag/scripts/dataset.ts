/**
 * Check labeled.csv, fill in missing ids, and split it into index / dev / test.
 *
 *   npm run flags:dataset              # fill ids, check, split
 *   npm run flags:dataset -- --check   # fill ids and check only
 *   npm run flags:dataset -- --reset   # brand-new split (unfreezes test; use a new index name afterwards)
 *   npm run flags:dataset -- --retire-test   # old test rows join the index; only rows new to the split become test
 *                                            # (none new: test is left empty, e.g. to give the site every example)
 *   npm run flags:dataset -- --resplit --to-index id1,id2   # keep dev, re-split all other rows into index / test;
 *                                                            # the listed ids (notes studied while tuning) stay out of test
 *
 * Input:  ml/release-flag/data/labeled.csv  (id, language, text, label, source, group_id; suggested_label optional)
 * Output: ml/release-flag/data/splits/{index,dev,test}.jsonl and VERSION.json
 *
 * - Empty id      -> next free number for the source's prefix (gpt-, gem-, man-). Existing ids never change.
 * - Empty group_id -> the row's own id (a group of one). Rows sharing a group_id always land in the same split.
 * - The file is written back only when ids were filled in, after saving labeled.csv.bak.
 * - Split ~50 / 20 / 30 by rows, balanced by label x language x source. Groups already assigned keep their split.
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { LABELS, type FlagLabel } from "../../../src/features/releaseFlag/config";
import { DATA, fail, formatCsv, parseArgs, parseCsv, readJsonl, SPLITS, SPLITS_DIR, writeJsonl, type DatasetRow, type Split } from "./lib";

const REQUIRED = ["id", "language", "text", "label", "source", "group_id"]; // suggested_label is optional and ignored
const SOURCES: Record<string, string> = { chatgpt: "gpt", gemini: "gem", manual: "man" };
const TARGET: Record<Split, number> = { index: 0.5, dev: 0.2, test: 0.3 };
const DUP_SIMILARITY = 0.85;

// ---------- load, check, fill ids ----------

function loadAndFill(path: string): { rows: DatasetRow[]; filled: string[]; groupsFilled: number } {
  const raw = readFileSync(path, "utf8");
  const csv = parseCsv(raw);
  const missing = REQUIRED.filter((c) => !csv.header.includes(c));
  if (missing.length) throw new Error(`labeled.csv is missing column(s): ${missing.join(", ")}. See data/labeled.template.csv.`);
  const col = Object.fromEntries(csv.header.map((h, i) => [h, i]));

  const problems: string[] = [];
  const used = new Set<string>();
  for (const [i, r] of csv.rows.entries()) {
    if (r.length !== csv.header.length) problems.push(`line ${csv.lines[i]}: ${r.length} columns instead of ${csv.header.length} (a comma in the text without quotes?)`);
    const id = (r[col.id] ?? "").trim();
    if (id) {
      if (used.has(id)) problems.push(`line ${csv.lines[i]}: duplicate id ${id}`);
      used.add(id);
    }
  }
  if (problems.length) throw new Error(`${problems.length} problem(s) in labeled.csv:\n  ${problems.join("\n  ")}`);

  // Next free number per prefix, so new ids never clash with existing ones.
  const next: Record<string, number> = {};
  for (const id of used) {
    const m = /^([a-z]+)-(\d+)$/.exec(id);
    if (m) next[m[1]] = Math.max(next[m[1]] ?? 0, Number(m[2]));
  }

  const filled: string[] = [];
  let groupsFilled = 0;
  const rows: DatasetRow[] = [];
  for (const [i, r] of csv.rows.entries()) {
    const where = `line ${csv.lines[i]}`;
    const get = (c: string) => (r[col[c]] ?? "").trim();
    const source = get("source");
    if (!SOURCES[source]) problems.push(`${where}: source must be one of ${Object.keys(SOURCES).join(", ")}, got "${source}"`);
    const language = get("language");
    if (language !== "he" && language !== "en") problems.push(`${where}: language must be he or en, got "${language}"`);
    const label = get("label") as FlagLabel;
    if (!LABELS.includes(label)) problems.push(`${where}: label must be ok or needs_attention, got "${get("label")}"`);
    const text = get("text");
    if (!text) problems.push(`${where}: text is empty`);
    if (text.length > 1000) problems.push(`${where}: text is over 1000 characters (the site's limit)`);
    if (problems.length) continue;

    let id = get("id");
    if (!id) {
      const prefix = SOURCES[source];
      next[prefix] = (next[prefix] ?? 0) + 1;
      id = `${prefix}-${String(next[prefix]).padStart(3, "0")}`;
      r[col.id] = id;
      filled.push(`${where}: ${id}`);
    }
    let group = get("group_id");
    if (!group) {
      group = id;
      r[col.group_id] = id;
      groupsFilled++;
    }
    rows.push({ id, group_id: group, language: language as "he" | "en", label, source, text });
  }
  if (problems.length) throw new Error(`${problems.length} problem(s) in labeled.csv:\n  ${problems.join("\n  ")}`);

  if (filled.length || groupsFilled) {
    copyFileSync(path, `${path}.bak`);
    writeFileSync(path, formatCsv(csv));
  }
  return { rows, filled, groupsFilled };
}

// ---------- near-duplicates (character-bigram similarity, same language) ----------

function bigrams(s: string): Map<string, number> {
  const t = s.toLowerCase().replace(/\s+/g, " ").trim();
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1);
  return m;
}

function similarity(a: Map<string, number>, b: Map<string, number>): number {
  let shared = 0, total = 0;
  for (const [k, v] of a) { shared += Math.min(v, b.get(k) ?? 0); total += v; }
  for (const v of b.values()) total += v;
  return total ? (2 * shared) / total : 0;
}

function nearDuplicates(rows: DatasetRow[]): [string, string, number][] {
  const found: [string, string, number][] = [];
  const grams = rows.map((r) => bigrams(r.text));
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].language !== rows[j].language) continue;
      const s = similarity(grams[i], grams[j]);
      if (s >= DUP_SIMILARITY) found.push([rows[i].id, rows[j].id, s]);
    }
  return found;
}

// ---------- split ----------

function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assign(groups: Map<string, DatasetRow[]>, previous: Map<string, Split>, seed: number, allowed: readonly Split[] = SPLITS): Map<string, Split> {
  const cell = (r: DatasetRow) => `${r.label}|${r.language}|${r.source}`;
  const total = [...groups.values()].reduce((s, g) => s + g.length, 0);
  const cellTotal = new Map<string, number>();
  for (const g of groups.values()) for (const r of g) cellTotal.set(cell(r), (cellTotal.get(cell(r)) ?? 0) + 1);
  const counts = Object.fromEntries(SPLITS.map((s) => [s, new Map<string, number>()])) as Record<Split, Map<string, number>>;
  const sizes: Record<Split, number> = { index: 0, dev: 0, test: 0 };
  const result = new Map<string, Split>();
  const add = (g: string, s: Split) => {
    result.set(g, s);
    for (const r of groups.get(g)!) { counts[s].set(cell(r), (counts[s].get(cell(r)) ?? 0) + 1); sizes[s]++; }
  };

  for (const [g, rows] of groups) {
    const old = rows.map((r) => previous.get(r.id)).find(Boolean);
    if (old) add(g, old);
  }
  const rand = seededRandom(seed);
  const fresh = [...groups.keys()].filter((g) => !result.has(g)).sort();
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
  // Large and needs_attention-heavy groups first, so they spread out instead of landing wherever is left.
  fresh.sort((a, b) => {
    const na = (g: string) => groups.get(g)!.filter((r) => r.label === "needs_attention").length;
    return na(b) - na(a) || groups.get(b)!.length - groups.get(a)!.length;
  });
  for (const g of fresh) {
    const rows = groups.get(g)!;
    const deficit = (s: Split) => {
      let d = 0;
      for (const r of rows) { const want = TARGET[s] * cellTotal.get(cell(r))!; d += (want - (counts[s].get(cell(r)) ?? 0)) / Math.max(want, 1); }
      return d + (TARGET[s] * total - sizes[s]) / (TARGET[s] * total);
    };
    add(g, allowed.reduce((best, s) => (deficit(s) > deficit(best) ? s : best)));
  }
  return result;
}

function table(title: string, groups: Record<string, DatasetRow[]>) {
  const cols = (["he", "en"] as const).flatMap((lang) => LABELS.map((l) => [lang, l] as const));
  console.log(`\n${title.padEnd(9)}${"rows".padStart(6)}${cols.map(([g, l]) => `${g} ${l}`.padStart(20)).join("")}`);
  for (const [name, rows] of Object.entries(groups)) {
    const c = (g: string, l: string) => rows.filter((r) => r.language === g && r.label === l).length;
    console.log(`${name.padEnd(9)}${String(rows.length).padStart(6)}${cols.map(([g, l]) => String(c(g, l)).padStart(20)).join("")}`);
  }
}

// ---------- main ----------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const path = typeof args.labeled === "string" ? args.labeled : join(DATA, "labeled.csv");
  const outDir = typeof args.out === "string" ? args.out : SPLITS_DIR;
  if (!existsSync(path)) throw new Error(`${path} not found. Start from data/labeled.template.csv.`);

  const { rows, filled, groupsFilled } = loadAndFill(path);
  if (filled.length || groupsFilled) {
    console.log(`Filled in ${filled.length} id(s) and ${groupsFilled} group_id(s); saved to labeled.csv (old copy: labeled.csv.bak).`);
    for (const f of filled.slice(0, 30)) console.log(`  new id ${f}`);
    if (filled.length > 30) console.log(`  ... and ${filled.length - 30} more`);
  }
  console.log(`${rows.length} labeled rows, no format problems.`);

  const dups = nearDuplicates(rows);
  if (dups.length) {
    console.log(`\nWarning: ${dups.length} near-duplicate pair(s). Rewrite or delete one of each:`);
    for (const [a, b, s] of dups.slice(0, 20)) console.log(`  ${a} ~ ${b}  (${Math.round(s * 100)}% same)`);
  }
  const bySource = Object.fromEntries(Object.keys(SOURCES).map((s) => [s, rows.filter((r) => r.source === s)]));
  table("source", { ...bySource, all: rows });
  if (args.check) return;

  const groups = new Map<string, DatasetRow[]>();
  for (const r of rows) groups.set(r.group_id, [...(groups.get(r.group_id) ?? []), r]);
  const previous = new Map<string, Split>();
  if (!args.reset) for (const s of SPLITS) for (const r of readJsonl<DatasetRow>(join(outDir, `${s}.jsonl`))) previous.set(r.id, s);
  // --retire-test: once the test set has been looked at (its mistakes used to change rules or labels), it can't
  // measure unseen notes anymore. Its rows become index examples, and only rows new to the split form the new test.
  const retire = Boolean(args["retire-test"]);
  const resplit = Boolean(args.resplit);
  if ([retire, resplit, Boolean(args.reset)].filter(Boolean).length > 1) throw new Error("Use only one of --reset, --retire-test, --resplit.");
  // --resplit: dev rows (scored after every change) stay dev. Every other row is split again between index and test,
  // except --to-index ids: notes whose mistakes were studied to write rules, which must never be test.
  if (resplit) {
    const toIndex = new Set(String(args["to-index"] ?? "").split(",").map((x) => x.trim()).filter(Boolean));
    const unknown = [...toIndex].filter((id) => !rows.some((r) => r.id === id));
    if (unknown.length) throw new Error(`--to-index: unknown id(s) ${unknown.join(", ")}`);
    let dev = 0;
    for (const [id, s] of [...previous]) {
      if (s === "dev" && !toIndex.has(id)) dev++;
      else previous.delete(id);
    }
    for (const id of toIndex) previous.set(id, "index");
    console.log(`\nRe-splitting: ${dev} dev rows stay dev, ${toIndex.size} studied rows go to index, the other ${rows.length - dev - toIndex.size} rows are split into index / test.`);
  }
  if (retire) {
    let retired = 0;
    for (const [id, s] of previous) if (s === "test") { previous.set(id, "index"); retired++; }
    const fresh = rows.filter((r) => !previous.has(r.id)).length;
    console.log(`\nRetiring the old test set: ${retired} rows move to index; ${fresh} new rows become the test set.`);
    if (!fresh) console.log("The test set is now empty: add new notes and run --retire-test again before the next final test.");
  }
  const kept = rows.filter((r) => previous.has(r.id)).length;
  if (kept && !resplit) console.log(`\nKeeping the existing split for ${kept} rows${retire ? "" : " (test set stays frozen)"}.`);

  const where = assign(groups, previous, Number(args.seed ?? 13), retire ? ["test"] : resplit ? ["index", "test"] : SPLITS);
  const moved = rows.filter((r) => previous.has(r.id) && previous.get(r.id) !== where.get(r.group_id)).map((r) => r.id);
  if (moved.length) console.log(`Warning: ${moved.length} row(s) changed split because their group_id now joins rows from another split: ${moved.slice(0, 10).join(", ")}`);

  const splits = Object.fromEntries(SPLITS.map((s) => [s, rows.filter((r) => where.get(r.group_id) === s).sort((a, b) => a.id.localeCompare(b.id))])) as Record<Split, DatasetRow[]>;
  table("split", splits);
  console.log("\nRows per source in each split:");
  for (const s of SPLITS) console.log(`  ${s.padEnd(6)}` + Object.keys(SOURCES).map((src) => `${src} ${splits[s].filter((r) => r.source === src).length}`).join("  "));

  for (const s of SPLITS) writeJsonl(join(outDir, `${s}.jsonl`), splits[s]);
  const digest = createHash("sha256").update(JSON.stringify(SPLITS.map((s) => splits[s].map((r) => [r.id, r.label, r.text])))).digest("hex").slice(0, 12);
  const version = { version: `${new Date().toISOString().slice(0, 10)}-${digest}`, counts: Object.fromEntries(SPLITS.map((s) => [s, splits[s].length])) };
  writeFileSync(join(outDir, "VERSION.json"), JSON.stringify(version, null, 2) + "\n");
  console.log(`\nDataset version ${version.version}. Next: npm run flags:ingest (puts the index split into S3 Vectors).`);
  console.log("Don't open test.jsonl while tuning.");
}

try {
  main();
} catch (e) {
  fail(e);
}
