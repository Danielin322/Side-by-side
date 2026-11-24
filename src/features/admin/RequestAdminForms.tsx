"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, LoaderCircle, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { adminCloseRequest, adminReleaseRequest, flagFeedback, resolveIssue } from "@/features/requests/actions";
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

export type FlagInfo = {
  id: string;
  flag_outcome: "flagged" | "refused" | "failed" | null;
  flag_reason: string | null;
  flag_evidence: string | null;
  flag_feedback: "right" | "wrong" | null;
};

/** Why an automatic flag was raised, and buttons for the admin to say whether it was right. */
export function FlagDetails({ flag }: { flag: FlagInfo }) {
  const t = useTranslations("admin.attention.flag");
  const tReq = useTranslations("requests");
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState(flag.flag_feedback);
  const [error, setError] = useState<string | null>(null);
  const send = (value: "right" | "wrong") =>
    start(async () => {
      const r = await flagFeedback(flag.id, value);
      if (r.ok) {
        setFeedback(value);
        setError(null);
      } else setError(tReq(`errors.${r.error}`));
    });

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-surface-soft p-4 text-sm">
      {flag.flag_outcome === "flagged" ? (
        <>
          {flag.flag_reason && (
            <p className="text-ink">
              <span className="font-medium">{t("reason")}: </span>
              <span lang="en" dir="ltr">{flag.flag_reason}</span>
            </p>
          )}
          {flag.flag_evidence && (
            <p className="text-ink">
              <span className="font-medium">{t("evidence")}: </span>
              <q dir="auto">{flag.flag_evidence}</q>
            </p>
          )}
        </>
      ) : (
        <p className="text-ink">{t(flag.flag_outcome === "refused" ? "refused" : "failed")}</p>
      )}
      <p className="inline-flex items-center gap-1 text-ink-soft">
        <Sparkles aria-hidden className="size-4" />
        {t("aiNote")}
      </p>
      {flag.flag_outcome === "flagged" && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-ink">{feedback ? t(feedback === "right" ? "markedRight" : "markedWrong") : t("question")}</span>
          {(["right", "wrong"] as const).map((v) => {
            const Icon = v === "right" ? ThumbsUp : ThumbsDown;
            return (
              <button
                key={v}
                type="button"
                disabled={pending}
                aria-pressed={feedback === v}
                onClick={() => send(v)}
                className={`pill px-3 py-1.5 disabled:opacity-60 ${feedback === v ? "bg-primary text-primary-ink" : "bg-surface text-ink shadow-soft hover:bg-surface-soft"}`}
              >
                <Icon aria-hidden className="size-4" />
                {t(v)}
              </button>
            );
          })}
          {error && (
            <span role="alert" className="text-secondary">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
