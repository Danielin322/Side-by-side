// Settings for release-note flags, read from the environment. Shared by the site and the ml/release-flag scripts.

export type FlagLabel = "ok" | "needs_attention";
export const LABELS: readonly FlagLabel[] = ["ok", "needs_attention"];
export type Effort = "low" | "medium" | "high";

export interface FlagConfig {
  region: string;
  bucket: string;
  index: string;
  embedModel: string;
  model: string;
  topK: number; // similar notes fetched per label
  effort: Effort;
}

export const DEFAULTS: FlagConfig = {
  region: "eu-central-1",
  bucket: "side-by-side-release-flags",
  // The index name carries the embedding model and dataset version: a new model or a reset split gets a new index.
  index: "notes-cohere-mv3-v1",
  embedModel: "cohere.embed-multilingual-v3",
  model: "claude-haiku-5-5",
  topK: 4,
  effort: "low",
};

export function loadConfig(env: Record<string, string | undefined> = process.env): FlagConfig {
  const topK = Number(env.RELEASE_FLAG_TOP_K ?? DEFAULTS.topK);
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) throw new Error("RELEASE_FLAG_TOP_K must be a whole number 1–20");
  const effort = (env.RELEASE_FLAG_EFFORT ?? DEFAULTS.effort) as Effort;
  if (!["low", "medium", "high"].includes(effort)) throw new Error("RELEASE_FLAG_EFFORT must be low, medium or high");
  return {
    region: env.AWS_REGION || DEFAULTS.region,
    bucket: env.RELEASE_FLAG_VECTOR_BUCKET || DEFAULTS.bucket,
    index: env.RELEASE_FLAG_VECTOR_INDEX || DEFAULTS.index,
    embedModel: env.RELEASE_FLAG_EMBED_MODEL || DEFAULTS.embedModel,
    model: env.RELEASE_FLAG_MODEL || DEFAULTS.model,
    topK,
    effort,
  };
}
