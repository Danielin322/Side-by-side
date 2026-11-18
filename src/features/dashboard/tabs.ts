/**
 * The volunteer dashboard's tabs, in order. Kept in a plain module (not the "use client" DashboardTabs)
 * so the server page can use the list too: values exported from a client module are only references on the server.
 */
export const DASHBOARD_TABS = ["opportunities", "requests", "activity", "profile"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];
