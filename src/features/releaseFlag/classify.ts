import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { S3VectorsClient } from "@aws-sdk/client-s3vectors";

import { logEvent } from "@/lib/logs";
import { createAdminClient } from "@/lib/supabase/server";
import { loadConfig, type FlagConfig } from "./config";
import { classifyNote, FlagStageError, modelLabel, type FlagClients, type FlagResult } from "./core";

// Runs after a volunteer hands a case back (next/server `after()`), so the volunteer never waits for it.
// Flags only add: if anything fails, the note is still flagged ("failed") so an admin reads it.
// Logs carry ids, labels, timings and error details, never the note, the evidence quote or example texts.

type Stage = "config" | "load_note" | "embed" | "retrieve" | "classify" | "save_flag" | "unexpected";
type Outcome = "flagged" | "refused" | "failed";

const TIMEOUT_MS = { embed: 5_000, retrieve: 5_000, claude: 15_000 };
const REQUIRED_ENV = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "ANTHROPIC_API_KEY"] as const;

let clients: FlagClients | null = null;
function getClients(cfg: FlagConfig): FlagClients {
  clients ??= {
    bedrock: new BedrockRuntimeClient({ region: cfg.region, maxAttempts: 2, requestHandler: { requestTimeout: TIMEOUT_MS.embed } }),
    vectors: new S3VectorsClient({ region: cfg.region, maxAttempts: 2, requestHandler: { requestTimeout: TIMEOUT_MS.retrieve } }),
    anthropic: new Anthropic({ maxRetries: 1, timeout: TIMEOUT_MS.claude }),
  };
  return clients;
}

/** Technical details of an error for the log: name, message, HTTP status, request id. */
function errorDetails(e: unknown): Record<string, unknown> {
  const err = e instanceof FlagStageError ? e.cause : e;
  if (!(err instanceof Error)) return { error: String(err).slice(0, 500) };
  const meta = (err as { $metadata?: { httpStatusCode?: number; requestId?: string } }).$metadata;
  const status = (err as { status?: number }).status ?? meta?.httpStatusCode ?? null;
  const requestId = (err as { requestID?: string }).requestID ?? meta?.requestId ?? null;
  return { error_name: err.name, error: err.message.slice(0, 500), http_status: status, provider_request_id: requestId };
}

const LOG_MESSAGE: Record<Outcome | "ok", string> = {
  ok: "Hand-back note checked: no action needed",
  flagged: "Hand-back note flagged for an admin",
  refused: "Hand-back note flagged: the model gave no usable answer",
  failed: "Hand-back note couldn't be checked automatically, flagged for an admin",
};

export async function flagReleasedNote(requestId: string): Promise<void> {
  if (process.env.RELEASE_FLAG_ENABLED !== "true") return;
  const base: Record<string, unknown> = { request_id: requestId };
  const fail = (stage: Stage, e: unknown, extra: Record<string, unknown> = {}) =>
    logEvent({
      severity: "error",
      category: "release_flags",
      event: "release_flag.failed",
      message: `${LOG_MESSAGE.failed} (stage: ${stage})`,
      metadata: { ...base, stage, ...errorDetails(e), ...extra },
    });

  try {
    const admin = createAdminClient();
    if (!admin) return void (await fail("config", new Error("SUPABASE_SECRET_KEY is not set")));

    // The hand-back that was just saved: its note and who wrote it.
    const { data: event, error: loadError } = await admin
      .from("request_events")
      .select("id, actor, note")
      .eq("request_id", requestId)
      .eq("kind", "released")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; actor: string | null; note: string | null }>();
    if (loadError || !event) return void (await fail("load_note", new Error(loadError?.message ?? "hand-back not found")));
    if (!event.note?.trim()) return; // No note, nothing to check.
    base.event_id = event.id;
    base.note_length = event.note.length;

    const saveFlag = async (outcome: Outcome, fields: Record<string, unknown>) => {
      const { data, error } = await admin
        .from("request_issues")
        .insert({ request_id: requestId, volunteer_id: event.actor, kind: "auto_flag", note: event.note, event_id: event.id, flag_outcome: outcome, ...fields })
        .select("id")
        .single<{ id: string }>();
      if (error?.code === "23505") return null; // Already flagged for this hand-back.
      if (error) throw Object.assign(new Error(`${error.code} ${error.message}`), { name: "SaveFlagError" });
      return data.id;
    };

    let cfg: FlagConfig;
    try {
      const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
      if (missing.length) throw new Error(`missing environment variable(s): ${missing.join(", ")}`);
      cfg = loadConfig();
    } catch (e) {
      const issueId = await saveFlag("failed", {}).catch(() => null);
      return void (await fail("config", e, { issue_id: issueId }));
    }
    base.model = modelLabel(cfg);

    let result: FlagResult;
    try {
      result = await classifyNote(getClients(cfg), cfg, { note: event.note });
    } catch (e) {
      const stage: Stage = e instanceof FlagStageError ? e.stage : "classify";
      let issueId: string | null = null;
      try {
        issueId = await saveFlag("failed", { flag_model: modelLabel(cfg) });
      } catch (saveError) {
        await fail("save_flag", saveError, { first_failure_stage: stage, first_failure: errorDetails(e) });
        return;
      }
      return void (await fail(stage, e, { issue_id: issueId }));
    }

    const details = {
      ...base,
      label: result.label,
      outcome: result.outcome,
      stop_reason: result.stopReason,
      durations_ms: result.durationsMs,
      examples: result.examples.map((x) => ({ id: x.id, label: x.label, similarity: Number((1 - x.distance).toFixed(3)) })),
    };
    if (result.label === "ok") {
      await logEvent({ severity: "info", category: "release_flags", event: "release_flag.ok", message: LOG_MESSAGE.ok, metadata: details });
      return;
    }

    const outcome: Outcome = result.outcome === "ok" ? "flagged" : result.outcome === "refusal" ? "refused" : "failed";
    let issueId: string | null;
    try {
      issueId = await saveFlag(outcome, {
        flag_reason: result.reason_en.slice(0, 1000) || null,
        flag_evidence: result.evidence.slice(0, 1000) || null,
        flag_model: result.model,
        flag_examples: details.examples,
      });
    } catch (e) {
      return void (await fail("save_flag", e, { label: result.label, outcome: result.outcome }));
    }
    await logEvent({
      severity: outcome === "flagged" ? "warning" : "error",
      category: "release_flags",
      event: `release_flag.${outcome === "failed" ? "failed" : outcome}`,
      message: outcome === "failed" ? `${LOG_MESSAGE.failed} (stage: classify)` : LOG_MESSAGE[outcome],
      metadata: { ...details, issue_id: issueId, ...(outcome === "failed" ? { stage: "classify" } : {}) },
    });
  } catch (e) {
    // Never let the background check throw: log what we know.
    await fail("unexpected", e);
  }
}
