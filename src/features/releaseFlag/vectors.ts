// Labeled notes in AWS S3 Vectors: one index, `label` as filterable metadata, retrieval balanced by label.

import {
  DeleteVectorsCommand,
  ListVectorsCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  type S3VectorsClient,
} from "@aws-sdk/client-s3vectors";

import { LABELS, type FlagConfig, type FlagLabel } from "./config";

export interface LabeledNote {
  id: string;
  label: FlagLabel;
  language: string;
  source: string;
  text: string;
}

export interface SimilarNote {
  id: string;
  label: FlagLabel;
  language: string;
  text: string;
  distance: number; // cosine distance: 0 = same meaning, larger = less similar
}

/** Metadata keys that are stored but can't be filtered on. Only `label` is filterable. */
export const NON_FILTERABLE_KEYS = ["text", "language", "source"];
const PUT_BATCH = 500; // S3 Vectors limit per PutVectors call

export async function putNotes(client: S3VectorsClient, cfg: FlagConfig, notes: LabeledNote[], vectors: number[][]): Promise<void> {
  for (let i = 0; i < notes.length; i += PUT_BATCH) {
    await client.send(
      new PutVectorsCommand({
        vectorBucketName: cfg.bucket,
        indexName: cfg.index,
        vectors: notes.slice(i, i + PUT_BATCH).map((n, j) => ({
          key: n.id,
          data: { float32: vectors[i + j] },
          metadata: { label: n.label, language: n.language, source: n.source, text: n.text },
        })),
      }),
    );
  }
}

export async function listKeys(client: S3VectorsClient, cfg: FlagConfig): Promise<string[]> {
  const keys: string[] = [];
  let nextToken: string | undefined;
  do {
    const res = await client.send(new ListVectorsCommand({ vectorBucketName: cfg.bucket, indexName: cfg.index, maxResults: 500, nextToken }));
    for (const v of res.vectors ?? []) if (v.key) keys.push(v.key);
    nextToken = res.nextToken;
  } while (nextToken);
  return keys;
}

export async function deleteKeys(client: S3VectorsClient, cfg: FlagConfig, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += PUT_BATCH) {
    await client.send(new DeleteVectorsCommand({ vectorBucketName: cfg.bucket, indexName: cfg.index, keys: keys.slice(i, i + PUT_BATCH) }));
  }
}

/** The k most similar notes for each label, nearest first. Fetching per label means Claude always sees both kinds. */
export async function findSimilar(client: S3VectorsClient, cfg: FlagConfig, vector: number[], k: number): Promise<SimilarNote[]> {
  const perLabel = await Promise.all(
    LABELS.map(async (label) => {
      const res = await client.send(
        new QueryVectorsCommand({
          vectorBucketName: cfg.bucket,
          indexName: cfg.index,
          topK: k,
          queryVector: { float32: vector },
          filter: { label: { $eq: label } },
          returnMetadata: true,
          returnDistance: true,
        }),
      );
      return (res.vectors ?? []).map((v) => {
        const m = (v.metadata ?? {}) as Record<string, unknown>;
        return { id: String(v.key), label, language: String(m.language ?? ""), text: String(m.text ?? ""), distance: v.distance ?? 1 };
      });
    }),
  );
  return perLabel.flat().sort((a, b) => a.distance - b.distance);
}
