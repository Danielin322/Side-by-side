"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { reportClientError } from "@/features/logs/actions";

/** Shown when a page crashes. Reports the error to the admin Logs screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    reportClientError({ message: error.message || "Unknown error", digest: error.digest, path: window.location.pathname }).catch(
      () => {},
    );
  }, [error]);

  return (
    <section className="container-page py-24 text-center">
      <h1 className="text-3xl font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-ink-soft">{t("body")}</p>
      <button type="button" onClick={reset} className="btn-secondary mt-8 inline-flex">
        {t("retry")}
      </button>
    </section>
  );
}
