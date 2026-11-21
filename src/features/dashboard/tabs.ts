import { HeartHandshake, History, Search, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

/**
 * The volunteer dashboard's tabs, in order. Kept in a plain module (not the "use client" DashboardTabs)
 * so the server page can use the list too: values exported from a client module are only references on the server.
 */
export const DASHBOARD_TABS = ["opportunities", "requests", "activity", "profile"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export const TAB_ICONS: Record<DashboardTab | "admin", LucideIcon> = {
  opportunities: Search,
  requests: HeartHandshake,
  activity: History,
  profile: UserRound,
  admin: ShieldCheck,
};

/** One tab in the signed-in bar. Shared by the dashboard and the admin area so the bar looks the same in both. */
export const tabClass = (active: boolean) =>
  `-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-3 px-4 py-3 text-base font-medium transition-colors sm:px-5 ${
    active ? "border-primary text-ink" : "border-transparent text-ink-soft hover:text-ink"
  }`;

/** The bar's row: tabs side by side, scrolling sideways on narrow screens. */
export const TAB_BAR_CLASS = "flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]";
