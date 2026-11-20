import type { Instrumentation } from "next";

export function register() {}

/** Records unhandled server errors in system_logs (shown on /admin/logs). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const err = error as Error & { digest?: string };
  const { logEvent } = await import("@/lib/logs");
  await logEvent({
    severity: "error",
    category: "system",
    event: "system.unhandled_error",
    message: `Unhandled error on ${request.method} ${request.path.split("?")[0]}: ${err?.message ?? String(error)}`,
    metadata: {
      path: request.path.split("?")[0],
      method: request.method,
      digest: err?.digest,
      routeType: context.routeType,
      routePath: context.routePath,
      stack: err?.stack,
    },
  });
};
