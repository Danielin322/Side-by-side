import type { SupabaseClient } from "@supabase/supabase-js";
import { israelLocalToIso } from "@/lib/time";

export const LOG_SEVERITIES = ["info", "warning", "error"] as const;
export const LOG_CATEGORIES = ["requests", "volunteers", "meetings", "auth", "system", "release_flags"] as const;
export const LOGS_PAGE_SIZE = 50;
export const LOGS_EXPORT_LIMIT = 10_000;

export type LogSeverity = (typeof LOG_SEVERITIES)[number];
export type LogCategory = (typeof LOG_CATEGORIES)[number];

/** Audit log: what people did. Event log: errors, failed sign-ins and other system events. */
export const LOG_VIEWS = ["audit", "events"] as const;
export type LogView = (typeof LOG_VIEWS)[number];
export const VIEW_CATEGORIES: Record<LogView, readonly LogCategory[]> = {
  audit: ["requests", "volunteers", "meetings"],
  events: ["auth", "system", "release_flags"],
};

export type LogRow = {
  id: string;
  created_at: string;
  severity: LogSeverity;
  category: LogCategory;
  event: string;
  actor_id: string | null;
  actor_label: string | null;
  message: string;
  metadata: Record<string, unknown>;
};

export type LogFilters = {
  view: LogView;
  /** Selected severities; empty means all. */
  sev: LogSeverity[];
  cat: LogCategory | null;
  /** Israel-local dates, "YYYY-MM-DD", both inclusive. Empty means no limit on that side. */
  from: string;
  to: string;
  q: string;
  /** Exact actor_label: an email (also for failed logins with no account) or "system". */
  actor: string;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads filters from the URL, falling back to defaults for anything unknown. */
export function parseLogFilters(params: Params): LogFilters {
  const sev = one(params.sev)
    .split(",")
    .filter((s): s is LogSeverity => (LOG_SEVERITIES as readonly string[]).includes(s));
  const view: LogView = one(params.view) === "events" ? "events" : "audit";
  const cat = one(params.cat);
  let from = isoDate(one(params.from));
  let to = isoDate(one(params.to));
  if (from && to && from > to) [from, to] = [to, from];
  const page = Number.parseInt(one(params.page), 10);
  return {
    view,
    sev: [...new Set(sev)],
    // A category only counts if it belongs to the current view.
    cat: (VIEW_CATEGORIES[view] as readonly string[]).includes(cat) ? (cat as LogCategory) : null,
    from,
    to,
    q: one(params.q).trim().slice(0, 100),
    actor: one(params.actor).trim().slice(0, 254),
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** Query string for the filters, with overrides. Defaults are left out to keep URLs short. */
export function logFiltersQuery(f: LogFilters, overrides: Partial<LogFilters> = {}): string {
  const m = { ...f, ...overrides };
  const qs = new URLSearchParams();
  if (m.view !== "audit") qs.set("view", m.view);
  if (m.sev.length) qs.set("sev", m.sev.join(","));
  if (m.cat) qs.set("cat", m.cat);
  if (m.from) qs.set("from", m.from);
  if (m.to) qs.set("to", m.to);
  if (m.q) qs.set("q", m.q);
  if (m.actor) qs.set("actor", m.actor);
  if (m.page > 1) qs.set("page", String(m.page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Severities a query should include: the selected pills, or all of them. */
export function effectiveSeverities(f: LogFilters): LogSeverity[] {
  return f.sev.length ? f.sev : [...LOG_SEVERITIES];
}

/** "YYYY-MM-DD" if the value is a real calendar date, otherwise "". */
function isoDate(v: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && israelLocalToIso(v, "00:00") ? v : "";
}

/** The day after an Israel-local "YYYY-MM-DD". */
function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Characters that would break PostgREST's or() syntax or act as wildcards.
const cleanSearch = (q: string) => q.replace(/[,()%*\\:"]/g, " ").trim();

/**
 * Applies the filters to a system_logs query. `severities` overrides the severity filter
 * (used for the per-severity counts, which ignore the severity pills).
 */
// Only the filter methods used below; keeps TypeScript from expanding Supabase's deep builder types.
interface Filterable {
  in(column: string, values: readonly string[]): Filterable;
  eq(column: string, value: string): Filterable;
  gte(column: string, value: string): Filterable;
  lt(column: string, value: string): Filterable;
  or(filters: string): Filterable;
}

export function applyLogFilters<Q>(query: Q, f: LogFilters, severities: LogSeverity[] = effectiveSeverities(f)): Q {
  let q = (query as unknown as Filterable).in("severity", severities.length ? severities : ["__none__"]);
  q = f.cat ? q.eq("category", f.cat) : q.in("category", VIEW_CATEGORIES[f.view]);
  if (f.actor) q = q.eq("actor_label", f.actor);
  // From the start of the first day to the end of the last day, in Israel time.
  const start = f.from ? israelLocalToIso(f.from, "00:00") : null;
  const end = f.to ? israelLocalToIso(nextDay(f.to), "00:00") : null;
  if (start) q = q.gte("created_at", start);
  if (end) q = q.lt("created_at", end);
  const search = cleanSearch(f.q);
  if (search) q = q.or(`message.ilike.*${search}*,actor_label.ilike.*${search}*,event.ilike.*${search}*`);
  return q as unknown as Q;
}

export const LOG_COLUMNS = "id, created_at, severity, category, event, actor_id, actor_label, message, metadata";

/** One page of logs, newest first, with the total count. */
export async function fetchLogsPage(supabase: SupabaseClient, f: LogFilters) {
  const from = (f.page - 1) * LOGS_PAGE_SIZE;
  const { data, count, error } = await applyLogFilters(
    supabase.from("system_logs").select(LOG_COLUMNS, { count: "exact" }),
    f,
  )
    .order("created_at", { ascending: false })
    .range(from, from + LOGS_PAGE_SIZE - 1)
    .returns<LogRow[]>();
  return { rows: data ?? [], total: count ?? 0, error };
}

/** How many rows each severity has under the other filters (for the severity pills). */
export async function fetchSeverityCounts(supabase: SupabaseClient, f: LogFilters) {
  const entries = await Promise.all(
    LOG_SEVERITIES.map(async (s) => {
      const { count } = await applyLogFilters(
        supabase.from("system_logs").select("id", { count: "exact", head: true }),
        f,
        [s],
      );
      return [s, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Partial<Record<LogSeverity, number>>;
}

/** CSV with RFC 4180 quoting. Cells that look like formulas are prefixed so spreadsheets don't run them. */
export function logsToCsv(rows: LogRow[]): string {
  const cell = (v: unknown) => {
    let s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["timestamp", "severity", "category", "event", "actor", "actor_id", "message", "metadata"];
  const lines = rows.map((r) =>
    [r.created_at, r.severity, r.category, r.event, r.actor_label, r.actor_id, r.message, r.metadata].map(cell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
