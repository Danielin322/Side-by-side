import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/guard";
import { NotesForm, StatusForm } from "@/features/admin/AdminForms";
import { ageFromIsoDate } from "@/lib/validation";
import { VOLUNTEER_LANGUAGE_NAMES, type VolunteerLanguage, type VolunteerStatus } from "@/features/volunteer/schema";

type Volunteer = {
  id: string;
  created_at: string;
  status: VolunteerStatus;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  occupation: string | null;
  availability: string[];
  commit_six_months: boolean;
  transport: string[];
  languages: { code: VolunteerLanguage; level: string }[];
  support_types: string[];
  meeting_modes: string[];
  experience: string | null;
  motivation: string;
  skills: string | null;
};
type Sensitive = { national_id: string; birth_date: string; admin_notes: string | null };

export default async function AdminVolunteerPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(props);
  await requireAdmin(locale);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const t = await getTranslations("admin");
  const tv = await getTranslations("volunteer");
  const ti = await getTranslations("intake");
  const supabase = await createSessionClient();
  const [{ data: v }, { data: s }] = await Promise.all([
    supabase.from("volunteers").select("*").eq("id", id).maybeSingle<Volunteer>(),
    supabase.from("volunteer_sensitive").select("national_id, birth_date, admin_notes").eq("volunteer_id", id).maybeSingle<Sensitive>(),
  ]);
  if (!v) notFound();

  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" });
  const list = (items: string[]) => items.join(" · ") || "—";
  const availabilityText = v.availability
    .map((slot) => {
      const [day, time] = slot.split("_") as [string, string];
      return `${tv(`availability.days.${day}` as Parameters<typeof tv>[0])} ${tv(`availability.slots.${time}` as Parameters<typeof tv>[0])}`;
    })
    .join(" · ");

  const rows: [string, React.ReactNode][] = [
    [t("detail.email"), <span key="e" dir="ltr">{v.email}</span>],
    [t("detail.phone"), <a key="p" href={`tel:${v.phone}`} dir="ltr" className="text-primary underline">{v.phone}</a>],
    [tv("personal.city"), v.city],
    [tv("personal.occupation"), v.occupation ?? "—"],
    [tv("personal.nationalId"), s ? <span key="i" dir="ltr">{s.national_id}</span> : "—"],
    [tv("personal.birthDate"), s ? `${dateFmt.format(new Date(s.birth_date))} (${ageFromIsoDate(s.birth_date)})` : "—"],
    [tv("availability.weekly"), availabilityText],
    [tv("availability.commit"), tv(`availability.commitOptions.${v.commit_six_months ? "yes" : "no"}`)],
    [tv("availability.transport"), list(v.transport.map((x) => tv(`availability.transportOptions.${x}` as Parameters<typeof tv>[0])))],
    [
      tv("languages.title"),
      list(v.languages.map((l) => `${VOLUNTEER_LANGUAGE_NAMES[l.code] ?? l.code} (${tv(`languages.levels.${l.level}` as Parameters<typeof tv>[0])})`)),
    ],
    [tv("offer.support"), list(v.support_types.map((x) => ti(`support.options.${x}.title` as Parameters<typeof ti>[0])))],
    [tv("offer.meeting"), list(v.meeting_modes.map((x) => ti(`meeting.options.${x}` as Parameters<typeof ti>[0])))],
    [tv("background.motivation"), <span key="m" className="whitespace-pre-line">{v.motivation}</span>],
    [tv("background.experience"), <span key="x" className="whitespace-pre-line">{v.experience ?? "—"}</span>],
    [tv("background.skills"), v.skills ?? "—"],
  ];

  return (
    <section className="container-page max-w-4xl py-10 sm:py-14">
      <Link href={`${routes.admin}?status=${v.status}`} className="pill -ms-3 text-ink-soft hover:bg-surface-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t("detail.back")}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-ink sm:text-4xl">{v.full_name}</h1>
      <p className="mt-1 text-ink-soft">{t("appliedOn", { date: dateFmt.format(new Date(v.created_at)) })}</p>

      <div className="mt-8 rounded-3xl bg-surface p-6 shadow-soft">
        <StatusForm id={v.id} status={v.status} />
      </div>

      <dl className="mt-6 divide-y divide-line/60 rounded-3xl bg-surface shadow-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="text-sm font-medium text-ink-soft">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-3xl bg-surface p-6 shadow-soft">
        <NotesForm id={v.id} notes={s?.admin_notes ?? ""} />
      </div>
    </section>
  );
}
