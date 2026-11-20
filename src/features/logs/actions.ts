"use server";

import { z } from "zod";
import { logEvent } from "@/lib/logs";

const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(500),
  digest: z.string().max(100).optional(),
  path: z.string().max(300).optional(),
});

/**
 * Lets client components (the error boundary) report a crash. Severity, category and event are fixed here,
 * so a caller cannot write fake errors or audit events.
 */
export async function reportClientError(input: { message: string; digest?: string; path?: string }) {
  const parsed = clientErrorSchema.safeParse({
    message: String(input?.message ?? "").slice(0, 500),
    digest: input?.digest ? String(input.digest).slice(0, 100) : undefined,
    path: input?.path ? String(input.path).slice(0, 300) : undefined,
  });
  if (!parsed.success) return;
  const { message, digest, path } = parsed.data;
  await logEvent({
    severity: "warning",
    category: "system",
    event: "system.client_error",
    message: `Page error: ${message}`,
    metadata: { digest, path },
  });
}
