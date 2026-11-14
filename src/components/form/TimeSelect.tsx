"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/** "HH:MM" every `step` minutes across the day. */
function buildSlots(step: number) {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

/** Accepts "9", "930", "9:30", "09:30", "21.15" and returns "HH:MM", or null. */
export function parseTime(input: string): string | null {
  const s = input.trim().replace(".", ":");
  let h: number;
  let m: number;
  if (/^\d{1,2}$/.test(s)) [h, m] = [Number(s), 0];
  else if (/^\d{3,4}$/.test(s)) [h, m] = [Number(s.slice(0, -2)), Number(s.slice(-2))];
  else if (/^\d{1,2}:\d{2}$/.test(s)) [h, m] = s.split(":").map(Number) as [number, number];
  else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The next slot at or after the current time in Israel, used to position the list when nothing is chosen. */
function nextSlotNow(step: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const minutes = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
  const rounded = Math.ceil(minutes / step) * step;
  return rounded >= 24 * 60 ? 0 : rounded / step;
}

/**
 * Time field with a dropdown list of times (like Google Calendar).
 * Click or focus to open; pick with the mouse, arrow keys + Enter, or type a time and press Enter/Tab.
 * Follows the ARIA combobox pattern so screen readers announce the list and the highlighted time.
 */
export function TimeSelect({
  id,
  value,
  onChange,
  step = 15,
  required,
  className = "",
  placeholder = "--:--",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const slots = useMemo(() => buildSlots(step), [step]);
  const autoId = useId();
  const inputId = id ?? `time-${autoId}`;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [active, setActiveState] = useState(0);
  // Mirror of `active` so fast repeated key presses always step from the latest position.
  const activeRef = useRef(0);
  const setActive = (i: number) => {
    activeRef.current = i;
    setActiveState(i);
  };
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setDraft(value), [value]);

  // Index of the chosen time, or the slot just after it, or "now" when empty.
  const indexFor = (time: string) => {
    if (!time) return nextSlotNow(step);
    const exact = slots.indexOf(time);
    if (exact >= 0) return exact;
    const after = slots.findIndex((s) => s > time);
    return after >= 0 ? after : slots.length - 1;
  };

  const openList = () => {
    if (open) return;
    setActive(indexFor(parseTime(draft) ?? value));
    setOpen(true);
  };

  // Keep the highlighted time in view; centre it when the list first opens.
  const firstScroll = useRef(true);
  useEffect(() => {
    if (!open) {
      firstScroll.current = true;
      return;
    }
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: firstScroll.current ? "center" : "nearest" });
    firstScroll.current = false;
  }, [open, active]);

  const commit = (time: string) => {
    onChange(time);
    setDraft(time);
    setOpen(false);
  };

  const commitDraft = (text: string) => {
    const parsed = parseTime(text);
    if (parsed) commit(parsed);
    else {
      setDraft(value);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={draft}
        dir="ltr"
        onFocus={openList}
        onClick={openList}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseTime(e.target.value);
          if (parsed) setActive(indexFor(parsed));
          if (!open) setOpen(true);
        }}
        onBlur={(e) => commitDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return openList();
            const next = Math.min(slots.length - 1, Math.max(0, activeRef.current + (e.key === "ArrowDown" ? 1 : -1)));
            setActive(next);
            setDraft(slots[next]);
          } else if (e.key === "PageDown" || e.key === "PageUp") {
            e.preventDefault();
            const next = Math.min(slots.length - 1, Math.max(0, activeRef.current + (e.key === "PageDown" ? 4 : -4)));
            setActive(next);
            setDraft(slots[next]);
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            // What's in the field (typed or reached with the arrows) wins; otherwise the highlighted slot.
            commit(parseTime(e.currentTarget.value) ?? slots[activeRef.current]);
          } else if (e.key === "Escape" && open) {
            // Close the list without closing the surrounding dialog.
            e.preventDefault();
            e.stopPropagation();
            setDraft(value);
            setOpen(false);
          }
        }}
        className={`${className} [direction:ltr] rtl:text-right`}
      />
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          // Keep focus in the input while clicking an option.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-2xl bg-surface py-1.5 shadow-lifted ring-1 ring-line"
        >
          {slots.map((slot, i) => {
            const selected = slot === value;
            return (
              <li
                key={slot}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onClick={() => commit(slot)}
                onMouseMove={() => i !== active && setActive(i)}
                dir="ltr"
                className={`cursor-pointer px-4 py-2.5 text-start text-ink rtl:text-right ${
                  i === active ? "bg-surface-soft" : ""
                } ${selected ? "font-semibold text-primary" : ""}`}
              >
                {slot}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
