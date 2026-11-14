import { getTranslations } from "next-intl/server";
import { BadgeCheck, ChevronRight, CircleSlash, Hourglass } from "lucide-react";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/guard";
import { AdminNav } from "@/features/admin/AdminNav";
import { VolunteerStatusActions } from "@/features/admin/VolunteerStatusActions";
import { meetingBadge, type MeetingRow } from "@/features/admin/meetings";
import type { VolunteerStatus } from "@/features/volunteer/schema";
import type { VolunteerView } from "@/features/admin/volunteerViews";

type Row = { id: string; created_at: string; status: VolunteerStatus; full_name: string; city: string; phone: string };

const VIEWS: { key: VolunteerView; Icon: typeof Hourglass }[] = [
  { key: "pending", Icon: Hourglass },
  { key: "verified", Icon: BadgeCheck },
  { key: "rejected", Icon: CircleSlash },
];
type View = VolunteerView;

/** Volunteers by tab: waiting for verification (with meeting and verify actions), verified, and not approved. */
export default async function AdminVolunteersPage(props: LocaleParams & { searchParams: Promise<{ view?: string }> }) {
  const locale = await resolveLocale(props);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const { view: requested } = await props.searchParams;
  const view: View = VIEWS.some((v) => v.key === requested) ? (requested as View) : "pending";

  const supabase = await createSessionClient();
  const [{ data: rows }, { data: active }] = await Promise.all([
    supabase.from("volunteers").select("id, created_at, status, full_name, city, phone").order("created_at").returns<Row[]>(),
    supabase.from("help_requests").select("assigned_to").eq("status", "in_progress").returns<{ assigned_to: string }[]>(),
  ]);
  const all = rows ?? [];
  const holding = (id: string) => active?.filter((r) => r.assigned_to === id).length ?? 0;
  const waiting = all.filter((v) => v.status === "applied" || v.status === "interview");

  // Meetings for people waiting: the open one, and whether the most recent closed one didn't happen.
  const { data: meetingRows } = waiting.length
    ? await supabase
        .from("volunteer_meetings")
        .select("id, volunteer_id, scheduled_at, link, note, outcome, created_at")
        .in("volunteer_id", waiting.map((v) => v.id))
        .order("updated_at", { ascending: false })
        .returns<MeetingRow[]>()
    : { data: [] as MeetingRow[] };
  const openMeeting = (id: string) => meetingRows?.find((m) => m.volunteer_id === id && m.outcome === "scheduled") ?? null;
  const lastMissed = (id: string) => meetingRows?.find((m) => m.volunteer_id === id && m.outcome !== "scheduled")?.outcome === "missed";
  const badges = new Map(
    await Promise.all(
      waiting.map(async (v) => {
        const m = openMeeting(v.id);
        return [v.id, m ? await meetingBadge(m.scheduled_at, locale) : null] as const;
      }),
    ),
  );
  // Meetings first (soonest, including ones that already passed and need a decision), then the rest by application date.
  const pending = [...waiting].sort((a, b) => {
    const ma = openMeeting(a.id)?.scheduled_at;
    const mb = openMeeting(b.id)?.scheduled_at;
    if (ma && mb) return ma.localeCompare(mb);
    if (ma) return -1;
    if (mb) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
  const verified = all.filter((v) => v.status === "approved");
  const rejected = all.filter((v) => v.status === "not_approved");
  const counts: Record<View, number> = { pending: pending.length, verified: verified.length, rejected: rejected.length };
  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" });

  const detailsLink = (v: Row) => (
    <Link href={`${routes.admin}/volunteers/${v.id}`} className="pill text-primary hover:bg-surface-soft">
      {t("volunteers.details")}
      <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
    </Link>
  );

  return (
    <section className="container-page py-10 sm:py-14">
      <AdminNav current="volunteers" />
      <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{t("volunteers.title")}</h1>
      <p className="mt-2 text-ink-soft">{t("volunteers.intro")}</p>

      <nav aria-label={t("filterLabel")} className="mt-8 flex flex-wrap gap-2">
        {VIEWS.map(({ key, Icon }) => (
          <Link
            key={key}
            href={`${routes.admin}?view=${key}`}
            aria-current={key === view ? "page" : undefined}
            className={`pill ${key === view ? "bg-primary text-primary-ink" : "bg-surface text-ink-soft shadow-soft hover:text-ink"}`}
          >
            <Icon aria-hidden className="size-4" />
            {t(`volunteers.tabs.${key}`)}
            <span className={`rounded-full px-2 text-xs ${key === view ? "bg-primary-ink/20" : "bg-surface-soft"}`}>{counts[key]}</span>
          </Link>
        ))}
      </nav>

      {/* Waiting for verification */}
      {view === "pending" && (
      <section aria-label={t("volunteers.tabs.pending")} className="mt-6">
        {pending.length > 0 ? (
          <ul className="space-y-3">
            {pending.map((v) => (
              <li key={v.id} className="rounded-3xl bg-surface p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium text-ink">{v.full_name}</p>
                    <p className="text-sm text-ink-soft">
                      {v.city} · <span dir="ltr">{v.phone}</span> · {t("appliedOn", { date: dateFmt.format(new Date(v.created_at)) })}
                    </p>
                  </div>
                  {detailsLink(v)}
                </div>
                <div className="mt-4">
                  <VolunteerStatusActions
                    id={v.id}
                    name={v.full_name}
                    status={v.status}
                    variant="list"
                    meeting={openMeeting(v.id)}
                    badge={badges.get(v.id)?.text}
                    passed={badges.get(v.id)?.passed}
                    lastMissed={lastMissed(v.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-surface-soft p-6 text-ink-soft">{t("volunteers.emptyPending")}</p>
        )}
      </section>
      )}

      {/* Verified */}
      {view === "verified" && (
      <section aria-label={t("volunteers.tabs.verified")} className="mt-6">
        {verified.length > 0 ? (
          <ul className="overflow-hidden rounded-3xl bg-surface shadow-soft">
            {verified.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 p-5 first:border-t-0">
                <div>
                  <p className="font-medium text-ink">{v.full_name}</p>
                  <p className="text-sm text-ink-soft">
                    {v.city} · <span dir="ltr">{v.phone}</span> · {t("volunteers.holding", { count: holding(v.id) })}
                  </p>
                </div>
                {detailsLink(v)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-surface-soft p-6 text-ink-soft">{t("volunteers.emptyVerified")}</p>
        )}
      </section>
      )}

      {/* Not approved */}
      {view === "rejected" && (
      <section aria-label={t("volunteers.tabs.rejected")} className="mt-6">
        {rejected.length > 0 ? (
          <ul className="overflow-hidden rounded-3xl bg-surface shadow-soft">
            {rejected.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 p-5 first:border-t-0">
                <div>
                  <p className="font-medium text-ink">{v.full_name}</p>
                  <p className="text-sm text-ink-soft">
                    {v.city} · <span dir="ltr">{v.phone}</span> · {t("appliedOn", { date: dateFmt.format(new Date(v.created_at)) })}
                  </p>
                </div>
                {detailsLink(v)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-surface-soft p-6 text-ink-soft">{t("volunteers.emptyRejected")}</p>
        )}
      </section>
      )}
    </section>
  );
}
