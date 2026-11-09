"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/** Placeholder for the future online chat: explains it is coming and points to the short form. */
export function ChatComingSoon() {
  const t = useTranslations("topBar");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={popId}
        className="pill bg-surface text-ink shadow-soft hover:shadow-lifted"
      >
        <MessageCircle aria-hidden className="size-4 text-secondary" />
        {t("chat")}
      </button>
      <div
        id={popId}
        role="status"
        hidden={!open}
        className="absolute end-0 top-full z-30 mt-2 w-72 rounded-2xl bg-surface p-4 text-sm shadow-lifted"
      >
        <p className="text-ink">{t("chatSoon")}</p>
        <Link href={routes.askForHelp} className="mt-3 inline-block font-medium text-primary underline-offset-4 hover:underline">
          {t("chatStart")}
        </Link>
      </div>
    </div>
  );
}
