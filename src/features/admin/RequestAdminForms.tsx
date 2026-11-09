"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, LoaderCircle } from "lucide-react";
import { adminCloseRequest, adminReleaseRequest, resolveIssue } from "@/features/requests/actions";
import type { RequestActionResult, RequestStatus } from "@/features/requests/model";

export function RequestAdminActions({ id, status }: { id: string; status: RequestStatus }) {
  const t = useTranslations("admin.requests");
  const tReq = useTranslations("requests");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RequestActionResult | null>(null);

  const run = (fn: () => Promise<RequestActionResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) setNote("");
    });

  return (
    <div>
      <label className="block">
        <span className="font-medium text-ink">{t("actionNote")}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className="mt-2 w-full resize-y rounded-2xl bg-surface-soft px-4 py-3 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {status !== "open" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => adminReleaseRequest(id, note))}
            className="pill bg-primary px-5 py-3 text-base text-primary-ink hover:bg-primary-hover disabled:opacity-60"
          >
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {t("release")}
          </button>
        )}
        {status !== "closed" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => adminCloseRequest(id, note))}
            className="pill bg-surface-soft px-5 py-3 text-base text-ink hover:shadow-soft disabled:opacity-60"
          >
            {t("close")}
          </button>
        )}
        {result?.ok && (
          <span role="status" className="inline-flex items-center gap-1 text-sm text-primary">
            <Check aria-hidden className="size-4" />
            {t("done")}
          </span>
        )}
        {result && !result.ok && (
          <span role="alert" className="text-sm text-secondary">
            {tReq(`errors.${result.error}`)}
          </span>
        )}
      </div>
    </div>
  );
}

export function ResolveIssueButton({ id }: { id: string }) {
  const t = useTranslations("admin.attention");
  const tReq = useTranslations("requests");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RequestActionResult | null>(null);
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await resolveIssue(id)))}
        className="pill bg-surface-soft px-4 py-2 text-ink hover:shadow-soft disabled:opacity-60"
      >
        {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
        {t("resolve")}
      </button>
      {result && !result.ok && (
        <span role="alert" className="text-sm text-secondary">
          {tReq(`errors.${result.error}`)}
        </span>
      )}
    </span>
  );
}
