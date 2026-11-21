"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { localeDirection, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { DASHBOARD_TABS, TAB_BAR_CLASS, TAB_ICONS, tabClass, type DashboardTab } from "./tabs";

const isTab = (v: string | null): v is DashboardTab => !!v && (DASHBOARD_TABS as readonly string[]).includes(v);

/**
 * The volunteer dashboard's main tabs. Panels are rendered on the server and passed in;
 * the chosen tab is kept in the URL (?tab=) so a refresh stays put.
 * For admins, `adminTab` adds an "Admin area" link at the end of the bar (its pages live elsewhere).
 */
export function DashboardTabs({
  labels,
  label,
  panels,
  defaultTab,
  adminTab,
}: {
  labels: Record<DashboardTab, string>;
  label: string;
  panels: Record<DashboardTab, ReactNode>;
  defaultTab: DashboardTab;
  adminTab?: { href: string; label: string };
}) {
  const dir = localeDirection[useLocale() as Locale];
  const params = useSearchParams();
  const [tab, setTab] = useState<DashboardTab>(() =>
    isTab(params.get("tab")) ? (params.get("tab") as DashboardTab) : defaultTab,
  );
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
      <div className={TAB_BAR_CLASS}>
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1">
          {DASHBOARD_TABS.map((t) => {
            const active = t === tab;
            const Icon = TAB_ICONS[t];
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
                className={tabClass(active)}
              >
                <Icon aria-hidden className="size-5" />
                {labels[t]}
              </button>
            );
          })}
        </div>
        {adminTab && (
          <Link href={adminTab.href} className={tabClass(false)}>
            <TAB_ICONS.admin aria-hidden className="size-5" />
            {adminTab.label}
          </Link>
        )}
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
