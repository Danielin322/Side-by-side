import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/guard";
import { AdminNav } from "@/features/admin/AdminNav";
import { VOLUNTEER_STATUSES, type VolunteerStatus } from "@/features/volunteer/schema";

type Row = { id: string; created_at: string; status: VolunteerStatus; full_name: string; city: string };

export default async function AdminPage(props: LocaleParams & { searchParams: Promise<{ status?: string }> }) {
  const locale = await resolveLocale(props);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const { status: requested } = await props.searchParams;
  const filter = VOLUNTEER_STATUSES.includes(requested as VolunteerStatus) ? (requested as VolunteerStatus) : "applied";

  const supabase = await createSessionClient();
  const [{ data: rows }, { data: all }] = await Promise.all([
    supabase
      .from("volunteers")
      .select("id, created_at, status, full_name, city")
      .eq("status", filter)
      .order("created_at", { ascending: true })
      .returns<Row[]>(),
    supabase.from("volunteers").select("status").returns<{ status: VolunteerStatus }[]>(),
  ]);
  const counts = Object.fromEntries(VOLUNTEER_STATUSES.map((s) => [s, all?.filter((r) => r.status === s).length ?? 0]));
  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" });

  return (
    <section className="container-page py-10 sm:py-14">
      <AdminNav current="volunteers" />
      <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-ink-soft">{t("intro")}</p>

      <nav aria-label={t("filterLabel")} className="mt-8 flex flex-wrap gap-2">
        {VOLUNTEER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`${routes.admin}?status=${s}`}
            aria-current={s === filter ? "page" : undefined}
            className={`pill ${s === filter ? "bg-primary text-primary-ink" : "bg-surface text-ink-soft shadow-soft hover:text-ink"}`}
          >
            {t(`statuses.${s}`)}
            <span className={`rounded-full px-2 text-xs ${s === filter ? "bg-primary-ink/20" : "bg-surface-soft"}`}>{counts[s]}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-6 overflow-hidden rounded-3xl bg-surface shadow-soft">
        {rows && rows.length > 0 ? (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-t border-line/60 first:border-t-0">
                <Link href={`${routes.admin}/volunteers/${r.id}`} className="flex items-center gap-4 p-5 hover:bg-surface-soft">
                  <span className="flex-1">
                    <span className="block font-medium text-ink">{r.full_name}</span>
                    <span className="block text-sm text-ink-soft">
                      {r.city} · {t("appliedOn", { date: dateFmt.format(new Date(r.created_at)) })}
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
