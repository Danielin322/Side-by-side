import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";
import { getViewer } from "@/features/auth/viewer";
import { ScrollToCurrent } from "@/components/ui/ScrollToCurrent";
import { DASHBOARD_TABS, TAB_BAR_CLASS, TAB_ICONS, tabClass } from "@/features/dashboard/tabs";

type Section = "volunteers" | "requests" | "attention" | "logs";

/**
 * Top of every admin page: the same bar as the volunteer dashboard with "Admin area" selected,
 * and the admin tabs in a second row underneath (with a count of unresolved issues).
 * Admins without a volunteer profile only see the "Admin area" tab, since the others would be empty.
 * `subnav` is an optional third row for the current section (the Logs page uses it for Audit / Event log).
 */
export async function AdminNav({ current, subnav }: { current: Section; subnav?: ReactNode }) {
  const [t, td, viewer, supabase] = await Promise.all([
    getTranslations("admin.nav"),
    getTranslations("dashboard.tabs"),
    getViewer(),
    createSessionClient(),
  ]);
  const { count } = await supabase
    .from("request_issues")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);

  const tabs: { key: Section; href: string; badge?: number }[] = [
    { key: "volunteers", href: routes.admin },
    { key: "requests", href: `${routes.admin}/requests` },
    { key: "attention", href: `${routes.admin}/attention`, badge: count ?? 0 },
    { key: "logs", href: `${routes.admin}/logs` },
  ];

  return (
    <div className="mb-8">
      <ScrollToCurrent label={td("label")} className={TAB_BAR_CLASS}>
        {viewer?.volunteer &&
          DASHBOARD_TABS.map((key) => {
            const Icon = TAB_ICONS[key];
            return (
              <Link key={key} href={`${routes.volunteerDashboard}?tab=${key}`} className={tabClass(false)}>
                <Icon aria-hidden className="size-5" />
                {td(key)}
              </Link>
            );
          })}
        <Link href={routes.admin} aria-current="true" className={tabClass(true)}>
          <TAB_ICONS.admin aria-hidden className="size-5" />
          {td("admin")}
        </Link>
      </ScrollToCurrent>

      <ScrollToCurrent label={t("label")} className="flex gap-1 overflow-x-auto bg-surface-soft/60 px-1 [scrollbar-width:none]">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === current ? "page" : undefined}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${
              tab.key === current ? "border-primary bg-primary-soft text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t(tab.key)}
            {!!tab.badge && (
              <span className="rounded-full bg-secondary px-2 text-xs text-primary-ink">{tab.badge}</span>
            )}
          </Link>
        ))}
      </ScrollToCurrent>
      {subnav}
      {viewer && !viewer.volunteer && (
        // Every admin is also a volunteer: remind admins who haven't filled in their profile yet.
        <p className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary-soft p-4 text-ink">
          <span>{t("completeProfile")}</span>
          <Link href={routes.volunteer} className="pill bg-primary px-4 py-2 text-primary-ink hover:bg-primary-hover">
            {t("completeProfileButton")}
          </Link>
        </p>
      )}
    </div>
  );
}
