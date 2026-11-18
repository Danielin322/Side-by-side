"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { HeartHandshake, History, Search, UserRound, type LucideIcon } from "lucide-react";
import { localeDirection, type Locale } from "@/i18n/routing";
import { DASHBOARD_TABS, type DashboardTab } from "./tabs";

const ICONS: Record<DashboardTab, LucideIcon> = {
  opportunities: Search,
  requests: HeartHandshake,
  activity: History,
  profile: UserRound,
};
const isTab = (v: string | null): v is DashboardTab => !!v && (DASHBOARD_TABS as readonly string[]).includes(v);

/**
 * The volunteer dashboard's main tabs. Panels are rendered on the server and passed in;
 * the chosen tab is kept in the URL (?tab=) so a refresh stays put.
 */
export function DashboardTabs({
  labels,
  label,
  panels,
  defaultTab,
}: {
  labels: Record<DashboardTab, string>;
  label: string;
  panels: Record<DashboardTab, ReactNode>;
  defaultTab: DashboardTab;
}) {
  const dir = localeDirection[useLocale() as Locale];
  const params = useSearchParams();
  const [tab, setTab] = useState<DashboardTab>(() => (isTab(params.get("tab")) ? (params.get("tab") as DashboardTab) : defaultTab));
  const refs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({
    opportunities: null,
    requests: null,
    activity: null,
    profile: null,
  });
  const baseId = useId();

  const select = (next: DashboardTab, focus = false) => {
    setTab(next);
    if (focus) refs.current[next]?.focus();
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  };

  // Arrow keys move between tabs; in RTL the visual order is mirrored.
  const onKeyDown = (e: KeyboardEvent) => {
    const i = DASHBOARD_TABS.indexOf(tab);
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: number | null = null;
    if (e.key === forward) next = (i + 1) % DASHBOARD_TABS.length;
    else if (e.key === back) next = (i - 1 + DASHBOARD_TABS.length) % DASHBOARD_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = DASHBOARD_TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(DASHBOARD_TABS[next], true);
  };

  return (
    <div className="mt-12">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]"
      >
        {DASHBOARD_TABS.map((t) => {
          const active = t === tab;
          const Icon = ICONS[t];
          return (
            <button
              key={t}
              ref={(el) => {
                refs.current[t] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${t}`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(t)}
              className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-3 px-4 py-3 text-base font-medium transition-colors sm:px-5 ${
                active ? "border-primary text-ink" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              <Icon aria-hidden className="size-5" />
              {labels[t]}
            </button>
          );
        })}
      </div>

      {DASHBOARD_TABS.map((t) => (
        <div
          key={t}
          role="tabpanel"
          id={`${baseId}-panel-${t}`}
          aria-labelledby={`${baseId}-tab-${t}`}
          hidden={t !== tab}
          tabIndex={0}
          className="pt-8 outline-none"
        >
          {panels[t]}
        </div>
      ))}
    </div>
  );
}
