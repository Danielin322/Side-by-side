/**
 * Put the `index` split into S3 Vectors: embed each whole note and store it with its label.
 *
 *   npm run flags:ingest -- --dry-run   # counts only, no AWS calls
 *   npm run flags:ingest
 *
 * Re-running overwrites notes by id. Vectors in the index that aren't in the index split (for example after a
 * --reset split) are deleted, so dev and test notes can never be retrieved as examples.
 */

import { loadConfig } from "../../../src/features/releaseFlag/config";
import { embedNotes } from "../../../src/features/releaseFlag/embed";
import { deleteKeys, listKeys, putNotes } from "../../../src/features/releaseFlag/vectors";
import { createClients, datasetVersion, fail, parseArgs, readSplit } from "./lib";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  const rows = readSplit("index");
  const count = (l: string) => rows.filter((r) => r.label === l).length;
  console.log(`Dataset ${datasetVersion()}: ${rows.length} index notes (ok ${count("ok")}, needs_attention ${count("needs_attention")})`);
  console.log(`-> ${cfg.region} / ${cfg.bucket} / ${cfg.index}, embeddings ${cfg.embedModel}`);
  if (!rows.length) throw new Error("The index split is empty.");
  if (args["dry-run"]) return;

  const { bedrock, vectors } = createClients(cfg);
  console.log("Embedding...");
  const embeddings = await embedNotes(bedrock, cfg.embedModel, rows.map((r) => r.text));
  console.log("Writing to S3 Vectors...");
  await putNotes(vectors, cfg, rows, embeddings);

  const wanted = new Set(rows.map((r) => r.id));
  const stale = (await listKeys(vectors, cfg)).filter((k) => !wanted.has(k));
  if (stale.length) {
    await deleteKeys(vectors, cfg, stale);
    console.log(`Removed ${stale.length} vector(s) that are no longer in the index split: ${stale.slice(0, 10).join(", ")}`);
  }
  console.log(`Done: ${rows.length} notes in ${cfg.index}. Next: npm run flags:eval -- --split dev`);
}

main().catch(fail);
