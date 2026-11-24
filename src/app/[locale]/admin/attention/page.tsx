import { getTranslations } from "next-intl/server";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/guard";
import { AdminNav } from "@/features/admin/AdminNav";
import { FlagDetails, ResolveIssueButton, type FlagInfo } from "@/features/admin/RequestAdminForms";

type Issue = Omit<FlagInfo, "id"> & {
  id: string;
  kind: "unreachable" | "professional" | "safety" | "coordinator" | "concern" | "auto_flag";
  note: string | null;
  created_at: string;
  request_id: string;
  help_requests: { first_name: string } | null;
  volunteers: { full_name: string } | null;
};

/** Safety first, then automatically flagged hand-back notes, then concerns, then the rest; oldest first within each. */
const PRIORITY: Record<Issue["kind"], number> = { safety: 0, auto_flag: 1, concern: 2, professional: 3, unreachable: 4, coordinator: 5 };

export default async function AdminAttentionPage(props: LocaleParams) {
  const locale = await resolveLocale(props);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const supabase = await createSessionClient();
  const { data } = await supabase
    .from("request_issues")
    .select(
      "id, kind, note, created_at, request_id, flag_outcome, flag_feedback, help_requests(first_name), volunteers(full_name)",
    )
    .is("resolved_at", null)
    .returns<Issue[]>();
  const issues = (data ?? []).sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.created_at.localeCompare(b.created_at));
  const dt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className="container-page max-w-5xl py-10 sm:py-16">
      <AdminNav current="attention" />
      {/* The tab above names the page; the heading stays for screen readers. */}
      <h1 className="sr-only">{t("attention.title")}</h1>

      {issues.length > 0 ? (
        <ul className="space-y-3">
          {issues.map((i) => (
            <li
              key={i.id}
              className={`rounded-3xl p-5 shadow-soft ${i.kind === "safety" ? "bg-secondary-soft ring-2 ring-secondary" : "bg-surface"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-64 flex-1">
                  <p className="font-semibold text-ink">{t(`attention.kinds.${i.kind}`)}</p>
                  {i.note && <p className="mt-1 whitespace-pre-line text-ink">{i.note}</p>}
                  <p className="mt-2 text-sm text-ink-soft">
                    {/* Each value is isolated, so English names and dates don't scramble the Hebrew line. */}
                    {t.rich("attention.meta", {
                      person: i.help_requests?.first_name ?? "—",
                      volunteer: i.volunteers?.full_name ?? t("requests.team"),
                      date: dt.format(new Date(i.created_at)),
                      v: (chunks) => <bdi>{chunks}</bdi>,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ResolveIssueButton id={i.id} />
                  <Link href={`${routes.admin}/requests/${i.request_id}`} className="pill text-primary hover:bg-surface-soft">
                    {t("attention.open")}
                    <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
                  </Link>
                </div>
              </div>
              {/* The automatic-check line sits at the bottom of the card, under the actions. */}
              {i.kind === "auto_flag" && <FlagDetails flag={i} />}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-4 rounded-3xl bg-surface-soft p-6 text-ink-soft">
          <ShieldCheck aria-hidden className="size-6 shrink-0 text-primary" />
          {t("attention.empty")}
        </div>
      )}
    </section>
  );
}
