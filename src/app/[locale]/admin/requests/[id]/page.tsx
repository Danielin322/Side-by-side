import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/guard";
import { AdminNav } from "@/features/admin/AdminNav";
import { FlagDetails, RequestAdminActions, ResolveIssueButton, type FlagInfo } from "@/features/admin/RequestAdminForms";
import { LANGUAGE_NAMES, type Language, type MeetingMode, type SupportType } from "@/features/intake/schema";
import type { ChecklistItem, RequestStatus } from "@/features/requests/model";

type Request = {
  id: string;
  created_at: string;
  status: RequestStatus;
  support_types: SupportType[];
  meeting_mode: MeetingMode;
  city: string | null;
  language: Language;
  note: string | null;
  first_name: string;
  /** Migration 0007; empty before it runs. */
  checklist_items?: ChecklistItem[];
  next_meeting: string | null;
  summary: string | null;
  assigned_at: string | null;
  volunteers: { full_name: string; phone: string } | null;
  help_request_contacts: { last_name: string; phone: string; email: string | null } | null;
};
type Event = { id: string; kind: string; reason: string | null; note: string | null; created_at: string; actor: string | null };
type Issue = FlagInfo & { kind: string; note: string | null; created_at: string; resolved_at: string | null };

export default async function AdminRequestPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(props);
  await requireAdmin(locale);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const t = await getTranslations("admin");
  const tr = await getTranslations("requests");
  const ti = await getTranslations("intake");
  const supabase = await createSessionClient();
  const [{ data: r }, { data: events }, { data: issues }] = await Promise.all([
    supabase
      .from("help_requests")
      .select("*, volunteers(full_name, phone), help_request_contacts(last_name, phone, email)")
      .eq("id", id)
      .maybeSingle<Request>(),
    supabase.from("request_events").select("id, kind, reason, note, created_at, actor").eq("request_id", id).order("created_at").returns<Event[]>(),
    supabase.from("request_issues").select("id, kind, note, created_at, resolved_at, flag_outcome, flag_reason, flag_evidence, flag_feedback").eq("request_id", id).order("created_at").returns<Issue[]>(),
  ]);
  if (!r) notFound();

  // Names for people in the history (volunteers; anyone else is shown as the team).
  const actorIds = [...new Set((events ?? []).map((e) => e.actor).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("volunteers").select("id, full_name").in("id", actorIds).returns<{ id: string; full_name: string }[]>()
    : { data: [] };
  const nameOf = (uid: string | null) => actors?.find((a) => a.id === uid)?.full_name ?? t("requests.team");

  const dt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const d = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" });
  const contact = r.help_request_contacts;
  const items = r.checklist_items ?? [];

  const rows: [string, React.ReactNode][] = [
    [t("requests.status"), t(`requests.statuses.${r.status}`)],
    [t("detail.phone"), contact ? <a href={`tel:${contact.phone}`} dir="ltr" className="text-primary underline">{contact.phone}</a> : "—"],
    [t("detail.email"), contact?.email ? <span dir="ltr">{contact.email}</span> : "—"],
    [t("requests.meeting"), `${ti(`meeting.options.${r.meeting_mode}`)}${r.city ? ` · ${r.city}` : ""}`],
    [t("requests.language"), <span key="l" lang={r.language}>{LANGUAGE_NAMES[r.language]}</span>],
    [tr("mine.note"), <span key="n" className="whitespace-pre-line">{r.note ?? "—"}</span>],
    [t("requests.volunteer"), r.volunteers ? `${r.volunteers.full_name} · ${r.volunteers.phone}` : "—"],
    [t("requests.checklist"), items.length ? `${items.filter((i) => i.done).length}/${items.length}` : "—"],
    [tr("mine.nextMeeting"), r.next_meeting ? d.format(new Date(r.next_meeting)) : "—"],
    [tr("complete.summary"), <span key="s" className="whitespace-pre-line">{r.summary ?? "—"}</span>],
  ];

  return (
    <section className="container-page max-w-5xl py-10 sm:py-16">
      <AdminNav current="requests" />
      <Link href={`${routes.admin}/requests?status=${r.status}`} className="pill -ms-3 text-ink-soft hover:bg-surface-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t("requests.back")}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-ink sm:text-4xl">
        {r.first_name} {contact?.last_name}
      </h1>
      <p className="mt-1 text-ink-soft">
        {t("requests.received", { date: d.format(new Date(r.created_at)) })} ·{" "}
        {r.support_types.map((s) => ti(`support.options.${s}.title`)).join(" · ")}
      </p>

      {(issues ?? []).length > 0 && (
        <div className="mt-8 space-y-3">
          {issues!.map((i) => (
            <div key={i.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-3xl p-5 ${i.resolved_at ? "bg-surface-soft" : "bg-secondary-soft"}`}>
              <div>
                <p className="font-medium text-ink">{t(`attention.kinds.${i.kind}` as Parameters<typeof t>[0])}</p>
                {i.note && <p className="mt-1 whitespace-pre-line text-ink">{i.note}</p>}
                {i.kind === "auto_flag" && <FlagDetails flag={i} />}
                <p className="mt-1 text-sm text-ink-soft">
                  {dt.format(new Date(i.created_at))}
                  {i.resolved_at ? ` · ${t("attention.resolved")}` : ""}
                </p>
              </div>
              {!i.resolved_at && <ResolveIssueButton id={i.id} />}
            </div>
          ))}
        </div>
      )}

      <dl className="mt-6 divide-y divide-line/60 rounded-3xl bg-surface shadow-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="text-sm font-medium text-ink-soft">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-3xl bg-surface p-6 shadow-soft">
        <RequestAdminActions id={r.id} status={r.status} />
      </div>

      <div className="mt-6 rounded-3xl bg-surface p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">{t("requests.history")}</h2>
        {(events ?? []).length > 0 ? (
          <ol className="mt-4 space-y-3">
            {events!.map((e) => (
              <li key={e.id} className="border-s-2 border-line ps-4">
                <p className="text-ink">
                  {t(`requests.events.${e.kind}` as Parameters<typeof t>[0], { name: nameOf(e.actor) })}
                  {e.reason ? ` · ${tr(`release.reasons.${e.reason}` as Parameters<typeof tr>[0])}` : ""}
                </p>
                {e.note && <p className="text-sm text-ink-soft">{e.note}</p>}
                <p className="text-sm text-ink-soft">{dt.format(new Date(e.created_at))}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-ink-soft">{t("requests.noHistory")}</p>
        )}
      </div>
    </section>
  );
}
