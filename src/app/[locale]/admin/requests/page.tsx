import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/guard";
import { AdminNav } from "@/features/admin/AdminNav";
import { REQUEST_STATUSES, type RequestStatus } from "@/features/requests/model";
import type { SupportType } from "@/features/intake/schema";

type Row = {
  id: string;
  created_at: string;
  status: RequestStatus;
  first_name: string;
  city: string | null;
  support_types: SupportType[];
  volunteers: { full_name: string } | null;
};

export default async function AdminRequestsPage(props: LocaleParams & { searchParams: Promise<{ status?: string }> }) {
  const locale = await resolveLocale(props);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const ti = await getTranslations("intake");
  const { status: requested } = await props.searchParams;
  const filter = REQUEST_STATUSES.includes(requested as RequestStatus) ? (requested as RequestStatus) : "open";

  const supabase = await createSessionClient();
  const [{ data: rows }, { data: all }] = await Promise.all([
    supabase
      .from("help_requests")
      .select("id, created_at, status, first_name, city, support_types, volunteers(full_name)")
      .eq("status", filter)
      .order("created_at", { ascending: true })
      .returns<Row[]>(),
    supabase.from("help_requests").select("status").returns<{ status: RequestStatus }[]>(),
  ]);
  const counts = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, all?.filter((r) => r.status === s).length ?? 0]));
  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" });

  return (
    <section className="container-page py-10 sm:py-14">
      <AdminNav current="requests" />
      <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{t("requests.title")}</h1>
      <p className="mt-2 text-ink-soft">{t("requests.intro")}</p>

      <nav aria-label={t("filterLabel")} className="mt-8 flex flex-wrap gap-2">
        {REQUEST_STATUSES.map((s) => (
          <Link
            key={s}
            href={`${routes.admin}/requests?status=${s}`}
            aria-current={s === filter ? "page" : undefined}
            className={`pill ${s === filter ? "bg-primary text-primary-ink" : "bg-surface text-ink-soft shadow-soft hover:text-ink"}`}
          >
            {t(`requests.statuses.${s}`)}
            <span className={`rounded-full px-2 text-xs ${s === filter ? "bg-primary-ink/20" : "bg-surface-soft"}`}>{counts[s]}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-6 overflow-hidden rounded-3xl bg-surface shadow-soft">
        {rows && rows.length > 0 ? (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-t border-line/60 first:border-t-0">
                <Link href={`${routes.admin}/requests/${r.id}`} className="flex items-center gap-4 p-5 hover:bg-surface-soft">
                  <span className="flex-1">
                    <span className="block font-medium text-ink">
                      {r.first_name}
                      {r.city ? ` · ${r.city}` : ""}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {r.support_types.map((s) => ti(`support.options.${s}.title`)).join(" · ")}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {t("requests.received", { date: dateFmt.format(new Date(r.created_at)) })}
                      {r.volunteers ? ` · ${t("requests.heldBy", { name: r.volunteers.full_name })}` : ""}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 text-ink-soft rtl:-scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-ink-soft">{t("empty")}</p>
        )}
      </div>
    </section>
  );
}
