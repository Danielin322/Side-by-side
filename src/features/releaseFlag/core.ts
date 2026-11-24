// Classifies one release note: embed it, find similar labeled notes in S3 Vectors, let Claude decide.
// No `server-only` import, so the ml/release-flag scripts run the exact same code as the site.

import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import type { S3VectorsClient } from "@aws-sdk/client-s3vectors";
import { z } from "zod/v4";

import type { FlagConfig, FlagLabel } from "./config";
import { embedNotes } from "./embed";
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt";
import { findSimilar, type SimilarNote } from "./vectors";

export interface FlagClients {
  bedrock: BedrockRuntimeClient;
  vectors: S3VectorsClient;
  anthropic: Anthropic;
}

export type FlagStage = "embed" | "retrieve" | "classify";

/** Thrown when a stage fails, so the caller can log which one (and still raise the fail-safe flag). */
export class FlagStageError extends Error {
  constructor(public readonly stage: FlagStage, public readonly cause: unknown) {
    super(`${stage} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "FlagStageError";
  }
}

export interface FlagResult {
  label: FlagLabel;
  evidence: string;
  reason_en: string;
  // "ok": Claude answered. "refusal" / "invalid": no usable answer, so label is the fail-safe needs_attention.
  outcome: "ok" | "refusal" | "invalid";
  stopReason: string | null;
  examples: Pick<SimilarNote, "id" | "label" | "distance">[];
  model: string; // "<model>@<prompt version>/<index>", stored with the flag
  durationsMs: Record<FlagStage, number>;
}

const FlagSchema = z.object({
  label: z.enum(["ok", "needs_attention"]),
  evidence: z.string(),
  reason_en: z.string(),
});

export const modelLabel = (cfg: FlagConfig) => `${cfg.model}@${PROMPT_VERSION}/${cfg.index}`;

async function stage<T>(name: FlagStage, durations: Partial<Record<FlagStage, number>>, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } catch (e) {
    throw new FlagStageError(name, e);
  } finally {
    durations[name] = Date.now() - start;
  }
}

/**
 * Throws FlagStageError if embedding, retrieval or the Claude call fails (network, key, missing index...).
 * A refusal or an unusable answer returns needs_attention with outcome "refusal" / "invalid".
 * `vector` skips the embedding call when the caller already has it (the eval embeds in batches).
 */
export async function classifyNote(
  clients: FlagClients,
  cfg: FlagConfig,
  input: { note: string; vector?: number[] },
): Promise<FlagResult & { similar: SimilarNote[] }> {
  const durations: Partial<Record<FlagStage, number>> = { embed: 0 };
  const vector = input.vector ?? (await stage("embed", durations, async () => (await embedNotes(clients.bedrock, cfg.embedModel, [input.note]))[0]));
  const similar = await stage("retrieve", durations, () => findSimilar(clients.vectors, cfg, vector, cfg.topK));

  const response = await stage("classify", durations, () =>
    clients.anthropic.messages.parse({
      model: cfg.model,
      // Haiku thinks adaptively and thinking counts toward max_tokens, so leave room beyond the short answer.
      max_tokens: 4000,
      output_config: { effort: cfg.effort, format: zodOutputFormat(FlagSchema) },
      // The rules are the same for every note, so they're cached; the examples and the note change each time.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserMessage(input.note, similar) }],
    }),
  );

  const base = {
    stopReason: response.stop_reason,
    examples: similar.map(({ id, label, distance }) => ({ id, label, distance })),
    similar,
    model: modelLabel(cfg),
    durationsMs: durations as Record<FlagStage, number>,
  };
  if (response.stop_reason === "refusal") {
    return { ...base, label: "needs_attention", evidence: "", reason_en: "The model declined to classify this note.", outcome: "refusal" };
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    return { ...base, label: "needs_attention", evidence: "", reason_en: `No valid answer (stop: ${response.stop_reason}).`, outcome: "invalid" };
  }
  return { ...base, ...parsed, outcome: "ok" };
}
