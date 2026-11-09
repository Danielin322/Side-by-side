"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localeDirection } from "@/i18n/routing";
import { Accessibility, Minus, Plus, RotateCcw, X } from "lucide-react";
import {
  type A11yPrefs,
  DEFAULT_PREFS,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  applyPrefs,
  loadPrefs,
  savePrefs,
} from "./preferences";

/** Discreet button fixed to the left edge that opens text-size, contrast and motion settings. */
export function AccessibilityPanel() {
  const t = useTranslations("a11y");
  const dir = localeDirection[useLocale()];
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_PREFS);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => setPrefs(loadPrefs()), []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function update(next: A11yPrefs) {
    setPrefs(next);
    applyPrefs(next);
    savePrefs(next);
  }

  return (
    // Physically on the left edge in both languages, as in the design brief.
    <div className="fixed bottom-4 left-0 z-40 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2" dir="ltr">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? titleId + "-panel" : undefined}
        aria-label={t("open")}
        title={t("open")}
        className="flex h-11 w-9 items-center justify-center rounded-r-xl bg-secondary text-primary-ink shadow-soft transition-[width] hover:w-11"
      >
        <Accessibility aria-hidden className="size-5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={titleId + "-panel"}
          role="dialog"
          aria-labelledby={titleId}
          dir={dir}
          className="absolute bottom-0 left-12 w-72 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-3xl bg-surface p-5 shadow-lifted"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {t("title")}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              className="rounded-full p-1.5 text-ink-soft hover:bg-surface-soft"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <div className="mt-4">
            <p className="text-sm text-ink-soft">{t("textSize")}</p>
            <div className="mt-2 flex items-center gap-2" dir="ltr">
              <button
                type="button"
                onClick={() => update({ ...prefs, textScale: Math.max(MIN_TEXT_SCALE, prefs.textScale - 1) })}
                disabled={prefs.textScale <= MIN_TEXT_SCALE}
                aria-label={t("smaller")}
                className="flex size-11 items-center justify-center rounded-full bg-surface-soft disabled:opacity-40"
              >
                <Minus aria-hidden className="size-5" />
              </button>
              <div className="flex flex-1 justify-center gap-1.5" aria-hidden>
                {Array.from({ length: MAX_TEXT_SCALE + 1 }, (_, i) => (
                  <span
                    key={i}
                    className={`size-2 rounded-full ${i <= prefs.textScale ? "bg-secondary" : "bg-line"}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => update({ ...prefs, textScale: Math.min(MAX_TEXT_SCALE, prefs.textScale + 1) })}
                disabled={prefs.textScale >= MAX_TEXT_SCALE}
                aria-label={t("larger")}
                className="flex size-11 items-center justify-center rounded-full bg-surface-soft disabled:opacity-40"
              >
                <Plus aria-hidden className="size-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Toggle label={t("contrast")} checked={prefs.contrast} onChange={(contrast) => update({ ...prefs, contrast })} />
            <Toggle label={t("motion")} checked={prefs.motion} onChange={(motion) => update({ ...prefs, motion })} />
          </div>

          <button
            type="button"
            onClick={() => update(DEFAULT_PREFS)}
            className="mt-4 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
          >
            <RotateCcw aria-hidden className="size-4" />
            {t("reset")}
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface-soft px-4 py-3 text-start"
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-line"}`}
      >
        <span
          className={`absolute top-1 size-4 rounded-full bg-surface shadow-soft transition-[inset-inline-start] ${checked ? "start-5" : "start-1"}`}
        />
      </span>
    </button>
  );
}
