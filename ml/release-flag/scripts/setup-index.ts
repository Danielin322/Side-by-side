/**
 * Create the S3 Vectors bucket and index (once per index name). Safe to re-run: existing ones are left alone.
 *
 *   npm run flags:setup
 *
 * Uses AWS_REGION, RELEASE_FLAG_VECTOR_BUCKET and RELEASE_FLAG_VECTOR_INDEX (defaults in src/features/releaseFlag/config.ts).
 */

import { ConflictException, CreateIndexCommand, CreateVectorBucketCommand, S3VectorsClient } from "@aws-sdk/client-s3vectors";

import { loadConfig } from "../../../src/features/releaseFlag/config";
import { EMBED_DIM } from "../../../src/features/releaseFlag/embed";
import { NON_FILTERABLE_KEYS } from "../../../src/features/releaseFlag/vectors";
import { fail } from "./lib";

async function main() {
  const cfg = loadConfig();
  const client = new S3VectorsClient({ region: cfg.region });
  console.log(`Region ${cfg.region}, bucket ${cfg.bucket}, index ${cfg.index}`);

  try {
    await client.send(new CreateVectorBucketCommand({ vectorBucketName: cfg.bucket }));
    console.log("Created vector bucket.");
  } catch (e) {
    if (!(e instanceof ConflictException)) throw e;
    console.log("Vector bucket already exists.");
  }

  try {
    await client.send(
      new CreateIndexCommand({
        vectorBucketName: cfg.bucket,
        indexName: cfg.index,
        dataType: "float32",
        dimension: EMBED_DIM,
        distanceMetric: "cosine",
        // Only `label` stays filterable, so retrieval can ask for the nearest notes of each label.
        metadataConfiguration: { nonFilterableMetadataKeys: NON_FILTERABLE_KEYS },
      }),
    );
    console.log(`Created index (${EMBED_DIM} dimensions, cosine, filterable metadata: label).`);
  } catch (e) {
    if (!(e instanceof ConflictException)) throw e;
    console.log("Index already exists. To change its settings, use a new RELEASE_FLAG_VECTOR_INDEX name.");
  }
  console.log("Next: npm run flags:ingest");
}

main().catch(fail);
