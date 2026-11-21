import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { ChevronDown, ChevronLeft, Shapes, ChevronRight, Download, Info, OctagonAlert, Search, TriangleAlert, X } from "lucide-react";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { APP_TIME_ZONE } from "@/lib/time";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/guard";
import { AdminNav } from "@/features/admin/AdminNav";
import { LogFilterForm } from "@/features/admin/LogFilterForm";
import { TimeFilter } from "@/features/admin/TimeFilter";
import {
  fetchLogsPage,
  fetchSeverityCounts,
  LOG_SEVERITIES,
  LOG_VIEWS,
  VIEW_CATEGORIES,
  logFiltersQuery,
  LOGS_PAGE_SIZE,
  parseLogFilters,
  type LogSeverity,
} from "@/features/admin/logs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SEVERITY_STYLE: Record<LogSeverity, { Icon: typeof Info; className: string }> = {
  info: { Icon: Info, className: "bg-info-soft text-info-ink" },
  warning: { Icon: TriangleAlert, className: "bg-warning-soft text-warning-ink" },
  error: { Icon: OctagonAlert, className: "bg-danger-soft text-danger-ink" },
};

const fieldClass =
  "rounded-2xl bg-surface px-4 py-2.5 text-sm text-ink shadow-soft outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary";

/** System logs: business events and errors, filterable, with metadata and CSV export. */
export default async function AdminLogsPage(props: LocaleParams & { searchParams: SearchParams }) {
  const locale = await resolveLocale(props);
  await requireAdmin(locale);
  const t = await getTranslations("admin.logs");
  const f = parseLogFilters(await props.searchParams);

  const supabase = await createSessionClient();
  const [{ rows, total, error }, counts] = await Promise.all([fetchLogsPage(supabase, f), fetchSeverityCounts(supabase, f)]);
  const pages = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));

  const dt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: APP_TIME_ZONE,
  });
  const base = `${routes.admin}/logs`;
  const href = (o: Parameters<typeof logFiltersQuery>[1]) => `${base}${logFiltersQuery(f, { page: 1, ...o })}`;
  // Event codes like "meeting.cancelled" map to nested keys under admin.logs.events; unknown codes show the stored message.
  const eventLabel = (event: string, fallback: string) => {
    const key = `events.${event}` as Parameters<typeof t>[0];
    return /^[a-z_]+\.[a-z_]+$/.test(event) && t.has(key) ? t(key) : fallback;
  };
  const toggleSeverity = (s: LogSeverity) => {
    const next = f.sev.includes(s) ? f.sev.filter((x) => x !== s) : [...f.sev, s];
    // Selecting every allowed severity is the same as no filter.
    return next.length === LOG_SEVERITIES.length ? [] : next;
  };

  return (
    <section className="container-page max-w-5xl py-10 sm:py-16">
      <AdminNav
        current="logs"
        subnav={
          // Audit log | Event log: two equal halves with a divider between them.
          <nav aria-label={t("viewLabel")} className="grid grid-cols-[1fr_auto_1fr] border-t border-line/60 bg-surface-soft/30">
            {LOG_VIEWS.map((v, i) => (
              <Fragment key={v}>
                {i > 0 && <span aria-hidden className="my-2 w-px bg-line" />}
                <Link
                  href={href({ view: v, sev: [], cat: null })}
                  aria-current={f.view === v ? "page" : undefined}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-center text-sm font-medium ${
                    f.view === v ? "border-primary bg-primary-soft text-ink" : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  {t(`views.${v}`)}
                </Link>
              </Fragment>
            ))}
          </nav>
        }
      />
      {/* The tabs above name the page; the heading stays for screen readers. */}
      <h1 className="sr-only">{t("title")}</h1>

      {/* Category, dates, search */}
      <LogFilterForm label={t("filtersLabel")}>
        {f.view !== "audit" && <input type="hidden" name="view" value={f.view} />}
        {f.sev.length > 0 && <input type="hidden" name="sev" value={f.sev.join(",")} />}
        {f.actor && <input type="hidden" name="actor" value={f.actor} />}
        {/* Styled like the Time button: icon at the start, chevron at the end, outlined when a category is set. */}
        <label className="relative flex items-center text-sm text-ink">
          <span className="sr-only">{t("category")}</span>
          <Shapes aria-hidden className="pointer-events-none absolute start-4 size-4" />
          <ChevronDown aria-hidden className="pointer-events-none absolute end-4 size-4 text-ink-soft" />
          <select
            name="cat"
            defaultValue={f.cat ?? ""}
            className={`${fieldClass} h-10 appearance-none rounded-full py-0 ps-10 pe-10 ${f.cat ? "ring-2 ring-primary" : ""}`}
          >
            <option value="">{t("allCategories")}</option>
            {VIEW_CATEGORIES[f.view].map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <TimeFilter
          from={f.from}
          to={f.to}
          fieldClass={fieldClass}
          labels={{ button: t("time"), from: t("from"), to: t("to"), clear: t("clearDates") }}
        />
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm text-ink-soft">
          <span className="sr-only">{t("search")}</span>
          <input type="search" name="q" defaultValue={f.q} placeholder={t("searchPlaceholder")} className={fieldClass} />
        </label>
        <button type="submit" className="pill bg-primary py-2.5 text-primary-ink hover:bg-primary-hover">
          <Search aria-hidden className="size-4" />
          {t("apply")}
        </button>
        {/* A plain <a>: the export is a file download from an API route, not a locale page. */}
        <a
          href={`/api/admin/logs/export${logFiltersQuery(f, { page: 1 })}`}
          className="pill bg-surface py-2.5 text-ink shadow-soft hover:bg-surface-soft"
          download
        >
          <Download aria-hidden className="size-4" />
          {t("export")}
        </a>
      </LogFilterForm>

      {/* Severity quick filters */}
      <div role="group" aria-label={t("severityLabel")} className="mt-4 flex flex-wrap items-center gap-2">
        {LOG_SEVERITIES.map((s) => {
          const { Icon, className } = SEVERITY_STYLE[s];
          const active = f.sev.includes(s);
          return (
            <Link
              key={s}
              href={href({ sev: toggleSeverity(s) })}
              aria-pressed={active}
              // Same colors as the severity badges in the table; the selected ones get an outline.
              className={`pill gap-1.5 px-3 py-1 text-xs ${className} ${active ? "ring-2 ring-current" : "hover:shadow-soft"}`}
            >
              <Icon aria-hidden className="size-4" />
              {t(`severities.${s}`)}
              <span className="rounded-full bg-surface/70 px-1.5 text-[11px]">{counts[s] ?? 0}</span>
            </Link>
          );
        })}
      </div>

      {f.actor && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          {t("person")}
          <Link href={href({ actor: "" })} className="pill bg-secondary-soft text-ink hover:bg-surface-soft">
            <span dir="ltr">{f.actor === "system" ? t("system") : f.actor}</span>
            <X aria-hidden className="size-4" />
            <span className="sr-only">{t("clearPerson")}</span>
          </Link>
        </p>
      )}

      {error ? (
        <p className="mt-6 rounded-3xl bg-secondary-soft p-6 text-ink">{t("loadFailed")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-surface-soft p-6 text-ink-soft">{t("empty")}</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl bg-surface shadow-soft">
          {/* Column headings (wide screens only; rows stack on phones) */}
          <div
            aria-hidden
            className="hidden grid-cols-[11rem_7rem_7rem_minmax(0,14rem)_minmax(0,1fr)_1.5rem] gap-4 border-b border-line/60 px-5 py-3 text-xs font-medium tracking-wide text-ink-soft uppercase md:grid"
          >
            <span>{t("columns.time")}</span>
            <span>{t("columns.severity")}</span>
            <span>{t("columns.category")}</span>
            <span>{t("columns.actor")}</span>
            <span>{t("columns.message")}</span>
            <span />
          </div>
          <ul>
            {rows.map((r) => {
              const { Icon, className } = SEVERITY_STYLE[r.severity] ?? SEVERITY_STYLE.info;
              const label = eventLabel(r.event, r.message);
              const actor = r.actor_label ?? "system";
              return (
                <li key={r.id} className="border-t border-line/60 first:border-t-0">
                  <details className="group">
                    <summary className="grid list-none grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1 px-5 py-4 hover:bg-surface-soft md:grid-cols-[11rem_7rem_7rem_minmax(0,14rem)_minmax(0,1fr)_1.5rem] md:items-center md:gap-4 [&::-webkit-details-marker]:hidden">
                      <time dateTime={r.created_at} className="col-span-2 text-sm text-ink-soft md:col-span-1">
                        {dt.format(new Date(r.created_at))}
                      </time>
                      <ChevronDown
                        aria-hidden
                        className="size-5 text-ink-soft transition-transform group-open:rotate-180 md:order-last"
                      />
                      <span className="flex flex-wrap items-center gap-2 md:contents">
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
                          <Icon aria-hidden className="size-3.5" />
                          {t(`severities.${r.severity}`)}
                        </span>
                        <span className="text-sm text-ink-soft">{t(`categories.${r.category}`)}</span>
                      </span>
                      <span className="col-span-3 min-w-0 md:col-span-1 md:row-auto">
                        <span className="block truncate text-sm text-ink" dir="ltr" title={actor}>
                          {actor === "system" ? t("system") : actor}
                        </span>
                      </span>
                      <span className="col-span-3 min-w-0 md:col-span-1">
                        <span className="block font-medium text-ink">{label}</span>
                        {label !== r.message && <span className="block truncate text-sm text-ink-soft" dir="ltr">{r.message}</span>}
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-line/60 bg-surface-soft px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                        <span>
                          {t("eventCode")}: <code dir="ltr">{r.event}</code>
                        </span>
                        {actor !== f.actor && (
                          <Link href={href({ actor })} className="pill bg-surface px-3 py-1 text-primary shadow-soft hover:bg-surface-soft">
                            {t("filterByPerson")}
                          </Link>
                        )}
                      </div>
                      <p className="text-sm text-ink" dir="ltr">
                        {r.message}
                      </p>
                      <pre
                        dir="ltr"
                        className="max-h-96 overflow-auto rounded-2xl bg-surface p-4 text-start text-xs leading-relaxed text-ink ring-1 ring-line"
                      >
                        {JSON.stringify(r.metadata ?? {}, null, 2)}
                      </pre>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t("pagination")} className="mt-6 flex items-center justify-between gap-3">
          {f.page > 1 ? (
            <Link href={href({ page: f.page - 1 })} className="pill bg-surface text-ink shadow-soft hover:bg-surface-soft">
              <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
              {t("newer")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-soft">{t("pageOf", { page: f.page, pages })}</span>
          {f.page < pages ? (
            <Link href={href({ page: f.page + 1 })} className="pill bg-surface text-ink shadow-soft hover:bg-surface-soft">
              {t("older")}
              <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
