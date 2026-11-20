import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export type LogSeverity = "info" | "warning" | "error";
export type LogCategory = "requests" | "volunteers" | "meetings" | "auth" | "system";

export type LogEntry = {
  severity: LogSeverity;
  category: LogCategory;
  /** Stable code, translated on the admin Logs screen, e.g. "auth.login_failed". */
  event: string;
  /** English fallback, also used in the CSV export. Never include submitted personal details. */
  message: string;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  /** Email or "system". Defaults to "system". */
  actorLabel?: string | null;
};

const MAX_STACK = 4000;

/**
 * Writes a row to system_logs with the secret key (the visitor may be signed out).
 * Never throws: if the write fails, the entry goes to the server console instead.
 */
export async function logEvent(entry: LogEntry): Promise<void> {
  const metadata = { ...entry.metadata };
  if (typeof metadata.stack === "string") metadata.stack = metadata.stack.slice(0, MAX_STACK);
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error("SUPABASE_SECRET_KEY is not set");
    const { error } = await admin.from("system_logs").insert({
      severity: entry.severity,
      category: entry.category,
      event: entry.event.slice(0, 80),
      message: entry.message.slice(0, 2000),
      metadata,
      actor_id: entry.actorId ?? null,
      actor_label: (entry.actorLabel ?? "system").slice(0, 254),
    });
    if (error) throw new Error(`${error.code} ${error.message}`);
  } catch (err) {
    console.error("[logs] could not write log:", err instanceof Error ? err.message : err, entry.event, entry.message);
  }
}

/** Logs an error to the console and to system_logs. */
export async function logError(
  category: LogCategory,
  event: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  console.error(`[${category}] ${message}`, metadata ?? "");
  await logEvent({ severity: "error", category, event, message, metadata });
}

/** Code and message of a Supabase/PostgREST error, for metadata. */
export const errorMeta = (error: { code?: string | null; message?: string } | null | undefined) => ({
  code: error?.code ?? null,
  error: error?.message ?? null,
});
