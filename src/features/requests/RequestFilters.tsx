"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { LANGUAGES, LANGUAGE_NAMES, SUPPORT_TYPES, type Language, type MeetingMode, type SupportType } from "@/features/intake/schema";
import { normalizeCity, type OpenRequest } from "./model";

type FilterMeeting = Exclude<MeetingMode, "any">;
const FILTER_MEETINGS: readonly FilterMeeting[] = ["in_person", "video", "phone"];

export type Filters = {
  support: SupportType[];
  meeting: FilterMeeting | null;
  language: Language | null;
  city: string;
};

export const NO_FILTERS: Filters = { support: [], meeting: null, language: null, city: "" };

export const activeFilterCount = (f: Filters) =>
  (f.support.length ? 1 : 0) + (f.meeting ? 1 : 0) + (f.language ? 1 : 0) + (f.city.trim() ? 1 : 0);

/** True when a request passes every active filter. "any" meeting mode fits every format. */
export function applyFilters(req: OpenRequest, f: Filters): boolean {
  if (f.support.length && !req.support_types.some((s) => f.support.includes(s))) return false;
  if (f.meeting && req.meeting_mode !== f.meeting && req.meeting_mode !== "any") return false;
  if (f.language && req.language !== f.language) return false;
  const city = normalizeCity(f.city);
  if (city && !(req.city && normalizeCity(req.city).includes(city))) return false;
  return true;
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        pressed ? "bg-ink text-surface" : "bg-surface-soft text-ink hover:shadow-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="mt-4 first:mt-0">
      <legend className="text-sm font-medium text-ink-soft">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** The "Filter" slot at the end of the tab bar: a button that opens a popover with the filters. */
export function FilterButton({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const t = useTranslations("requests.filters");
  const tIntake = useTranslations("intake");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const count = activeFilterCount(value);

  // Same open/close behaviour as the chat popover: Escape or a click outside closes it.
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

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const toggleSupport = (s: SupportType) =>
    set({ support: value.support.includes(s) ? value.support.filter((x) => x !== s) : [...value.support, s] });

  return (
    <div ref={wrapRef} className="flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex items-center gap-2 rounded-e-2xl border-s border-line px-4 py-3 font-medium sm:px-5 ${
          count ? "text-primary" : "text-ink"
        } hover:bg-surface-soft`}
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        <span className="hidden sm:inline">{t("button")}</span>
        <span className="sr-only sm:hidden">{t("button")}</span>
        {count > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-ink">
            {count}
            <span className="sr-only"> {t("active")}</span>
          </span>
        )}
        <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        id={panelId}
        role="group"
        aria-label={t("button")}
        hidden={!open}
        className="absolute end-0 top-full z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-surface p-5 shadow-lifted"
      >
        <Group label={t("support")}>
          {SUPPORT_TYPES.map((s) => (
            <Toggle key={s} pressed={value.support.includes(s)} onClick={() => toggleSupport(s)}>
              {tIntake(`support.options.${s}.title`)}
            </Toggle>
          ))}
        </Group>
        <Group label={t("meeting")}>
          {FILTER_MEETINGS.map((m) => (
            <Toggle key={m} pressed={value.meeting === m} onClick={() => set({ meeting: value.meeting === m ? null : m })}>
              {tIntake(`meeting.options.${m}`)}
            </Toggle>
          ))}
        </Group>
        <Group label={t("language")}>
          {LANGUAGES.map((l) => (
            <Toggle key={l} pressed={value.language === l} onClick={() => set({ language: value.language === l ? null : l })}>
              <span lang={l}>{LANGUAGE_NAMES[l]}</span>
            </Toggle>
          ))}
        </Group>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-ink-soft">{t("city")}</span>
          <input
            type="text"
            value={value.city}
            onChange={(e) => set({ city: e.target.value })}
            placeholder={t("cityPlaceholder")}
            maxLength={80}
            className="mt-2 w-full rounded-2xl bg-surface-soft px-4 py-2.5 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary"
          />
        </label>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            disabled={count === 0}
            className="text-sm font-medium text-secondary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {t("clear")}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="pill bg-primary px-4 py-2 text-primary-ink hover:bg-primary-hover">
            {t("done")}
          </button>
        </div>
      </div>
    </div>
  );
}
