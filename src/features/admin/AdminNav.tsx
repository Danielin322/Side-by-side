import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";

type Section = "volunteers" | "requests" | "attention";

/** Tabs across the admin area, with a count of unresolved issues. */
export async function AdminNav({ current }: { current: Section }) {
  const t = await getTranslations("admin.nav");
  const supabase = await createSessionClient();
  const { count } = await supabase
    .from("request_issues")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);

  const tabs: { key: Section; href: string; badge?: number }[] = [
    { key: "volunteers", href: routes.admin },
    { key: "requests", href: `${routes.admin}/requests` },
    { key: "attention", href: `${routes.admin}/attention`, badge: count ?? 0 },
  ];

  return (
    <nav aria-label={t("label")} className="mb-8 flex flex-wrap gap-1 border-b border-line/60">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 font-medium ${
            tab.key === current ? "border-primary text-ink" : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          {t(tab.key)}
          {!!tab.badge && (
            <span className="rounded-full bg-secondary px-2 text-xs text-primary-ink">{tab.badge}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
