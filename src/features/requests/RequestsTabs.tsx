"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Inbox, UserRound } from "lucide-react";
import { localeDirection, type Locale } from "@/i18n/routing";
import { OpenRequestCard } from "./RequestCards";
import { FilterButton, NO_FILTERS, activeFilterCount, applyFilters, type Filters } from "./RequestFilters";
import type { BestMatchPick, FitBadges, FitTag, OpenRequest } from "./model";

/** One open request with its rule score, badges and "asked x days ago" text, prepared on the server. */
export type BoardItem = { req: OpenRequest; score: number; badges: FitBadges; waiting: string };

const VIEWS = ["best", "newest", "all"] as const;
type View = (typeof VIEWS)[number];

const isView = (v: string | null): v is View => !!v && (VIEWS as readonly string[]).includes(v);

/**
 * Segmented tab bar over the open requests: Best matches, Newest, All requests (by fit), plus Filter.
 * `ranked` is already sorted by scoreFit(); `bestMatches` is the top picks from pickBestMatches().
 */
export function RequestsTabs({
  ranked,
  bestMatches,
  atLimit,
  embedded = false,
}: {
  ranked: BoardItem[];
  bestMatches: BestMatchPick[];
  atLimit: boolean;
  /** Inside the dashboard's Opportunities tab: no top margin, and the heading is for screen readers only. */
  embedded?: boolean;
}) {
  const t = useTranslations("requests");
  const dir = localeDirection[useLocale() as Locale];
  const params = useSearchParams();
  const [view, setView] = useState<View>(() => (isView(params.get("view")) ? (params.get("view") as View) : "best"));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({ best: null, newest: null, all: null });
  const baseId = useId();

  const filtered = useMemo(() => ranked.filter((i) => applyFilters(i.req, filters)), [ranked, filters]);
  const newest = useMemo(() => [...filtered].sort((a, b) => b.req.created_at.localeCompare(a.req.created_at)), [filtered]);
  const byId = useMemo(() => new Map(filtered.map((i) => [i.req.id, i])), [filtered]);
  const filtering = activeFilterCount(filters) > 0;

  const select = (v: View, focus = false) => {
    setView(v);
    if (focus) tabRefs.current[v]?.focus();
    // Keep the tab in the URL without a server round-trip, so a refresh keeps it.
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    window.history.replaceState(window.history.state, "", url);
  };

  // Arrow keys move between tabs; in RTL the visual order is mirrored, so left means "next".
  const onKeyDown = (e: KeyboardEvent) => {
    const i = VIEWS.indexOf(view);
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: number | null = null;
    if (e.key === forward) next = (i + 1) % VIEWS.length;
    else if (e.key === back) next = (i - 1 + VIEWS.length) % VIEWS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = VIEWS.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(VIEWS[next], true);
  };

  // Only Best matches has a subtitle. No counts are shown.
  const subtitles: Partial<Record<View, ReactNode>> = {
    best: (
      <span className="inline-flex items-center gap-1">
        <UserRound aria-hidden className="size-3.5" />
        {t("bestMatch.rulesLabel")}
      </span>
    ),
  };

  const empty = ranked.length === 0;
  const clearFilters = () => setFilters(NO_FILTERS);

  return (
    <section aria-labelledby={`${baseId}-title`} className={embedded ? "" : "mt-14"}>
      <h2 id={`${baseId}-title`} className={embedded ? "sr-only" : "text-2xl font-semibold text-ink"}>
        {t("open.title")}
      </h2>

      <div className={`relative flex rounded-2xl bg-surface shadow-soft ${embedded ? "" : "mt-5"}`}>
        <div
          role="tablist"
          aria-label={t("tabs.label")}
          onKeyDown={onKeyDown}
          className="flex min-w-0 flex-1 snap-x overflow-x-auto rounded-s-2xl [scrollbar-width:none]"
        >
          {VIEWS.map((v, i) => {
            const active = v === view;
            return (
              <button
                key={v}
                ref={(el) => {
                  tabRefs.current[v] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${v}`}
                aria-selected={active}
                aria-controls={`${baseId}-panel-${v}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(v)}
                className={`min-w-[8.5rem] flex-1 snap-start whitespace-nowrap px-4 py-3 text-start transition-colors sm:px-5 ${
                  i > 0 ? "border-s border-line" : ""
                } ${active ? "bg-ink text-surface" : "text-ink hover:bg-surface-soft"}`}
              >
                <span className="block font-semibold">{t(`tabs.${v}`)}</span>
                {subtitles[v] && (
                  <span className={`block text-sm ${active ? "opacity-80" : "text-ink-soft"}`}>{subtitles[v]}</span>
                )}
              </button>
            );
          })}
        </div>
        <FilterButton value={filters} onChange={setFilters} />
      </div>

      {VIEWS.map((v) => (
        <div
          key={v}
          role="tabpanel"
          id={`${baseId}-panel-${v}`}
          aria-labelledby={`${baseId}-tab-${v}`}
          hidden={v !== view}
          tabIndex={0}
          className="mt-5 outline-none"
        >
          {v !== view ? null : empty ? (
            <EmptyState>{t("open.empty")}</EmptyState>
          ) : v === "best" ? (
            <BestPanel picks={bestMatches} byId={byId} atLimit={atLimit} filtering={filtering} onClear={clearFilters} />
          ) : (
            <ItemList items={v === "newest" ? newest : filtered} atLimit={atLimit} filtering={filtering} onClear={clearFilters} />
          )}
        </div>
      ))}
    </section>
  );
}

type Picked = BoardItem & { fitTags: FitTag[] };

/** Best matches that pass the current filters, best first. */
function BestPanel({
  picks,
  byId,
  atLimit,
  filtering,
  onClear,
}: {
  picks: BestMatchPick[];
  byId: Map<string, BoardItem>;
  atLimit: boolean;
  filtering: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("requests");
  const picked = picks.flatMap((p): Picked[] => {
    const item = byId.get(p.requestId);
    return item ? [{ ...item, fitTags: p.fitTags }] : [];
  });
  if (picked.length === 0 && !filtering) return <EmptyState>{t("bestMatch.empty")}</EmptyState>;
  return <ItemList items={picked} atLimit={atLimit} filtering={filtering} onClear={onClear} />;
}

function ItemList({
  items,
  atLimit,
  filtering,
  onClear,
}: {
  items: (BoardItem & { fitTags?: FitTag[] })[];
  atLimit: boolean;
  filtering: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("requests.filters");
  if (items.length === 0 && filtering) {
    return (
      <EmptyState>
        <span>{t("empty")}</span>
        <button type="button" onClick={onClear} className="ms-auto font-medium text-secondary underline-offset-4 hover:underline">
          {t("clear")}
        </button>
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-4">
      {items.map(({ req, badges, waiting, fitTags }) => (
        <OpenRequestCard key={req.id} req={req} badges={badges} waiting={waiting} atLimit={atLimit} fitTags={fitTags} />
      ))}
    </ul>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface-soft p-6 text-ink-soft">
      <Inbox aria-hidden className="size-6 shrink-0" />
      {children}
    </div>
  );
}
