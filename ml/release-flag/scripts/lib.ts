// Helpers shared by the release-flag scripts (paths, CSV, JSONL, clients).

import Anthropic from "@anthropic-ai/sdk";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { S3VectorsClient } from "@aws-sdk/client-s3vectors";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FlagConfig, FlagLabel } from "../../../src/features/releaseFlag/config";
import type { FlagClients } from "../../../src/features/releaseFlag/core";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = join(ROOT, "data");
export const SPLITS_DIR = join(DATA, "splits");
export const SPLITS = ["index", "dev", "test"] as const;
export type Split = (typeof SPLITS)[number];

export interface DatasetRow {
  id: string;
  group_id: string;
  language: "he" | "en";
  label: FlagLabel;
  source: string;
  text: string;
}

// ---------- arguments ----------

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const a: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) throw new Error(`Unexpected argument ${k}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) a[k.slice(2)] = true;
    else a[k.slice(2)] = argv[++i];
  }
  return a;
}

// ---------- CSV (RFC 4180: quoted fields may hold commas, quotes and line breaks) ----------

export interface CsvFile {
  header: string[];
  rows: string[][]; // raw cells; rows may have the wrong length, which the caller reports
  lines: number[]; // file line where each row starts
  bom: boolean;
  eol: string;
}

export function parseCsv(text: string): CsvFile {
  const bom = text.startsWith("﻿");
  if (bom) text = text.slice(1);
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const all: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [], field = "", quoted = false, line = 1, rowStart = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else { if (c === "\n") line++; field += c; }
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); all.push(row); lines.push(rowStart);
      row = []; field = ""; line++; rowStart = line;
    } else field += c;
  }
  if (field || row.length) { row.push(field); all.push(row); lines.push(rowStart); }
  const [header = [], ...rest] = all;
  const keep = rest.map((r, i) => ({ r, l: lines[i + 1] })).filter(({ r }) => r.some((v) => v.trim()));
  return { header: header.map((h) => h.trim()), rows: keep.map((k) => k.r), lines: keep.map((k) => k.l), bom, eol };
}

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function formatCsv(file: CsvFile): string {
  const body = [file.header, ...file.rows].map((r) => r.map(quote).join(",")).join(file.eol) + file.eol;
  return (file.bom ? "﻿" : "") + body;
}

// ---------- JSONL ----------

export const readJsonl = <T>(path: string): T[] =>
  existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : [];

export function writeJsonl(path: string, rows: unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
}

export const readSplit = (split: Split) => {
  const file = join(SPLITS_DIR, `${split}.jsonl`);
  if (!existsSync(file)) throw new Error(`${file} not found. Run npm run flags:dataset first.`);
  return readJsonl<DatasetRow>(file);
};

export function datasetVersion(): string {
  const f = join(SPLITS_DIR, "VERSION.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).version : "unversioned";
}

// ---------- clients ----------

/** Clients for the scripts. AWS keys come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or an AWS profile). */
export function createClients(cfg: FlagConfig): FlagClients {
  return {
    bedrock: new BedrockRuntimeClient({ region: cfg.region }),
    vectors: new S3VectorsClient({ region: cfg.region }),
    anthropic: new Anthropic({ maxRetries: 3, timeout: 60_000 }),
  };
}

export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export function fail(e: unknown): never {
  console.error(`\nError: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
