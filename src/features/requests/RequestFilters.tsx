"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { LANGUAGES, LANGUAGE_NAMES, SUPPORT_TYPES, type Language, type MeetingMode, type SupportType } from "@/features/intake/schema";
import { normalizeCity, type OpenRequest } from "./model";

type FilterMeeting = Exclude<MeetingMode, "any">;
const FILTER_MEETINGS: readonly FilterMeeting[] = ["in_person", "video", "phone"];

/** Each list holds the options that are still ticked. Everything starts ticked; unticking hides those requests. */
export type Filters = {
  support: SupportType[];
  meeting: FilterMeeting[];
  language: Language[];
  city: string;
};

export const NO_FILTERS: Filters = {
  support: [...SUPPORT_TYPES],
  meeting: [...FILTER_MEETINGS],
  language: [...LANGUAGES],
  city: "",
};

/** How many groups hide something: a group counts once any of its boxes is unticked. */
export const activeFilterCount = (f: Filters) =>
  (f.support.length < SUPPORT_TYPES.length ? 1 : 0) +
  (f.meeting.length < FILTER_MEETINGS.length ? 1 : 0) +
  (f.language.length < LANGUAGES.length ? 1 : 0) +
  (f.city.trim() ? 1 : 0);

/**
 * True when a request passes every filter. A request needing several kinds of help shows while
 * any of them is ticked; "any" meeting mode fits whatever format is still ticked.
 */
export function applyFilters(req: OpenRequest, f: Filters): boolean {
  if (!req.support_types.some((s) => f.support.includes(s))) return false;
  if (req.meeting_mode === "any" ? f.meeting.length === 0 : !f.meeting.includes(req.meeting_mode)) return false;
  if (!f.language.includes(req.language)) return false;
  const city = normalizeCity(f.city);
  if (city && !(req.city && normalizeCity(req.city).includes(city))) return false;
  return true;
}

/** A real checkbox, styled like the request checklist so the boxes look the same across the site. */
function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-full bg-surface-soft py-1.5 pe-3 ps-2 text-sm text-ink hover:shadow-soft">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-md text-transparent ring-2 ring-line peer-checked:bg-primary peer-checked:text-primary-ink peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      {children}
    </label>
  );
}

/** Ticks or unticks one option in a list. */
const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/**
 * One section of checkboxes. The button beside the title unticks the whole section,
 * and once everything in it is unticked it turns into "Tick all" so it can be undone.
 */
function Group({
  label,
  allOff,
  onSetAll,
  children,
}: {
  label: string;
  allOff: boolean;
  onSetAll: (on: boolean) => void;
  children: ReactNode;
}) {
  const t = useTranslations("requests.filters");
  const titleId = useId();
  // A labelled group rather than a <fieldset>: a fieldset's legend can't share a row with the button.
  return (
    <div role="group" aria-labelledby={titleId} className="mt-4 first:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span id={titleId} className="text-sm font-medium text-ink-soft">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onSetAll(allOff)}
          aria-label={t(allOff ? "tickAllIn" : "untickAllIn", { section: label })}
          className="shrink-0 text-sm font-medium text-secondary underline-offset-4 hover:underline"
        >
          {t(allOff ? "tickAll" : "untickAll")}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
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
  // The filters as they were when the panel opened, so Cancel can put them back.
  const before = useRef<Filters>(value);

  const openPanel = () => {
    before.current = value;
    setOpen(true);
  };
  const cancel = () => {
    onChange(before.current);
    setOpen(false);
  };

  // Escape cancels the changes; a click outside keeps them, like Done.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onChange(before.current);
      setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onChange]);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });

  return (
    <div ref={wrapRef} className="flex shrink-0">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
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
        <Group
          label={t("support")}
          allOff={value.support.length === 0}
          onSetAll={(on) => set({ support: on ? [...SUPPORT_TYPES] : [] })}
        >
          {SUPPORT_TYPES.map((s) => (
            <Checkbox key={s} checked={value.support.includes(s)} onChange={() => set({ support: toggle(value.support, s) })}>
              {tIntake(`support.options.${s}.title`)}
            </Checkbox>
          ))}
        </Group>
        <Group
          label={t("meeting")}
          allOff={value.meeting.length === 0}
          onSetAll={(on) => set({ meeting: on ? [...FILTER_MEETINGS] : [] })}
        >
          {FILTER_MEETINGS.map((m) => (
            <Checkbox key={m} checked={value.meeting.includes(m)} onChange={() => set({ meeting: toggle(value.meeting, m) })}>
              {tIntake(`meeting.options.${m}`)}
            </Checkbox>
          ))}
        </Group>
        <Group
          label={t("language")}
          allOff={value.language.length === 0}
          onSetAll={(on) => set({ language: on ? [...LANGUAGES] : [] })}
        >
          {LANGUAGES.map((l) => (
            <Checkbox key={l} checked={value.language.includes(l)} onChange={() => set({ language: toggle(value.language, l) })}>
              <span lang={l}>{LANGUAGE_NAMES[l]}</span>
            </Checkbox>
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
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancel} className="pill bg-surface-soft px-4 py-2 text-ink hover:shadow-soft">
              {t("cancel")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="pill bg-primary px-4 py-2 text-primary-ink hover:bg-primary-hover">
              {t("done")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
