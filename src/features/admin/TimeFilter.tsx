"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";

type Labels = { button: string; from: string; to: string; clear: string };

/** "2026-11-20" -> "20.11.2026" */
const short = (iso: string) => iso.split("-").reverse().join(".");

/**
 * "Time" button that opens the From / To date fields. The fields stay in the form while closed,
 * so the chosen dates are always submitted with the rest of the filters.
 */
export function TimeFilter({
  from,
  to,
  labels,
  fieldClass,
}: {
  from: string;
  to: string;
  labels: Labels;
  fieldClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary = start && end ? `${short(start)} – ${short(end)}` : start ? `${short(start)} –` : end ? `– ${short(end)}` : "";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`${fieldClass} inline-flex h-10 items-center gap-2 rounded-full py-0 ${summary ? "ring-2 ring-primary" : ""}`}
      >
        <CalendarRange aria-hidden className="size-4" />
        {labels.button}
        {summary && (
          <span dir="ltr" className="text-ink-soft">
            {summary}
          </span>
        )}
        <ChevronDown aria-hidden className={`size-4 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute start-0 top-full z-20 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-3xl bg-surface p-4 shadow-soft ring-1 ring-line"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink-soft">
            {labels.from}
            <input
              type="date"
              name="from"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-soft">
            {labels.to}
            <input
              type="date"
              name="to"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className={fieldClass}
            />
          </label>
          {(start || end) && (
            <button
              type="button"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
              className="pill px-3 py-2.5 text-primary hover:bg-surface-soft"
            >
              {labels.clear}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
