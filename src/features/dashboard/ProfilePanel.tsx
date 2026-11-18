"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Bus, Car, CircleCheck, IdCard, Pencil } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { ChoiceCard, FieldError, Notice, TextField, errorMessageAt } from "@/components/form/FormParts";
import { SUPPORT_TYPES } from "@/features/intake/schema";
import { MEETING_ICONS, SUPPORT_ICONS } from "@/features/intake/icons";
import {
  DAYS,
  SLOTS,
  TRANSPORT,
  VOLUNTEER_LANGUAGE_NAMES,
  VOLUNTEER_MEETING_MODES,
  languagesToForm,
  profileSchema,
  type ProfileValues,
  type VolunteerLanguage,
} from "@/features/volunteer/schema";
import { AvailabilityGrid, LanguageLevels } from "@/features/volunteer/fields";
import { updateMyProfile, type ProfileResult } from "@/features/volunteer/actions";
import type { VolunteerDetails } from "./data";

const TRANSPORT_ICONS = { license: IdCard, car: Car, public_transit: Bus } as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-surface p-6 shadow-soft">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-ink-soft">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i} className="rounded-full bg-surface-soft px-3 py-1.5 text-sm text-ink">
          {i}
        </li>
      ))}
    </ul>
  );
}

/** The Profile tab: their details, with the practical ones editable. Name, email and ID stay with the team. */
export function ProfilePanel({ details, memberSince }: { details: VolunteerDetails; memberSince: string }) {
  const t = useTranslations("dashboard.profile");
  const tVol = useTranslations("volunteer");
  const tIntake = useTranslations("intake");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the section heading when switching between viewing and editing.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [editing]);

  const byDay = DAYS.map((d) => ({
    day: tVol(`availability.days.${d}`),
    slots: SLOTS.filter((s) => details.availability.includes(`${d}_${s}`)).map((s) => tVol(`availability.slots.${s}`)),
  })).filter((d) => d.slots.length > 0);

  return (
    <section aria-labelledby="profile-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="profile-title" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
          {editing ? t("editTitle") : t("title")}
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
            className="pill bg-surface px-4 py-2.5 text-ink shadow-soft hover:bg-surface-soft"
          >
            <Pencil aria-hidden className="size-4" />
            {t("edit")}
          </button>
        )}
      </div>

      {saved && !editing && (
        <p role="status" className="mt-5 flex items-center gap-3 rounded-2xl bg-primary-soft p-4 text-ink">
          <CircleCheck aria-hidden className="size-5 shrink-0 text-primary" />
          {t("saved")}
        </p>
      )}

      {editing ? (
        <ProfileForm
          details={details}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setSaved(true);
            setEditing(false);
          }}
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Group title={t("contact")}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              {(
                [
                  [tVol("personal.fullName"), details.full_name],
                  [tVol("account.email"), <span key="e" dir="ltr">{details.email}</span>],
                  [tVol("personal.phone"), <span key="p" dir="ltr">{details.phone}</span>],
                  [tVol("personal.city"), details.city],
                  [tVol("personal.occupation"), details.occupation || <span key="o" className="text-ink-soft">{t("none")}</span>],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-sm text-ink-soft sm:pt-0.5">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-ink-soft">{t("lockedNote")}</p>
          </Group>

          <Group title={tVol("availability.weekly")}>
            {byDay.length === 0 ? (
              <p className="text-ink-soft">{t("none")}</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                {byDay.map(({ day, slots }) => (
                  <div key={day} className="contents">
                    <dt className="font-medium text-ink">{day}</dt>
                    <dd className="text-ink-soft">{slots.join(", ")}</dd>
                  </div>
                ))}
              </dl>
            )}
            {details.commit_six_months && <p className="mt-4 text-sm text-ink-soft">{t("commit")}</p>}
          </Group>

          <Group title={t("languages")}>
            <Chips
              items={details.languages.map(
                (l) =>
                  `${VOLUNTEER_LANGUAGE_NAMES[l.code as VolunteerLanguage] ?? l.code} · ${tVol(`languages.levels.${l.level}` as Parameters<typeof tVol>[0])}`,
              )}
              empty={t("none")}
            />
          </Group>

          <Group title={t("support")}>
            <Chips items={details.support_types.map((s) => tIntake(`support.options.${s}.title`))} empty={t("none")} />
          </Group>

          <Group title={t("meeting")}>
            <Chips items={details.meeting_modes.map((m) => tIntake(`meeting.options.${m}`))} empty={t("none")} />
          </Group>

          <Group title={t("transport")}>
            <Chips items={details.transport.map((v) => tVol(`availability.transportOptions.${v}`))} empty={t("none")} />
          </Group>

          <p className="text-sm text-ink-soft lg:col-span-2">{t("memberSince", { date: memberSince })}</p>
        </div>
      )}
    </section>
  );
}

function ProfileForm({
  details,
  onCancel,
  onSaved,
}: {
  details: VolunteerDetails;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("dashboard.profile");
  const tVol = useTranslations("volunteer");
  const tIntake = useTranslations("intake");
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<ProfileResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
    defaultValues: {
      phone: details.phone,
      city: details.city,
      occupation: details.occupation ?? "",
      availability: details.availability as ProfileValues["availability"],
      transport: details.transport,
      languages: languagesToForm(details.languages),
      supportTypes: details.support_types,
      meetingModes: details.meeting_modes,
    },
  });

  const error = (field: FieldPath<ProfileValues>) => {
    const key = errorMessageAt(errors, field);
    return key ? tVol(`errors.${key}` as Parameters<typeof tVol>[0]) : undefined;
  };

  const save = handleSubmit((values) => {
    startSaving(async () => {
      const res = await updateMyProfile(values);
      setResult(res);
      if (res.ok) {
        router.refresh();
        onSaved();
      }
    });
  });

  return (
    <form noValidate onSubmit={save} className="mt-6 space-y-10">
      <div className="space-y-5 rounded-3xl bg-surface p-6 shadow-soft">
        <h3 className="font-semibold text-ink">{t("contact")}</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label={tVol("personal.city")} registration={register("city")} error={error("city")} autoComplete="address-level2" />
          <TextField
            label={tVol("personal.phone")}
            registration={register("phone")}
            error={error("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
          />
        </div>
        <TextField
          label={tVol("personal.occupation")}
          badge={tIntake("optional")}
          registration={register("occupation")}
          error={error("occupation")}
        />
        <p className="text-sm text-ink-soft">{t("lockedNote")}</p>
      </div>

      <AvailabilityGrid legend={tVol("availability.weekly")} registration={register("availability")} error={error("availability")} />

      <fieldset>
        <legend className="font-medium text-ink">
          {tVol("availability.transport")} <span className="font-normal text-ink-soft">({tIntake("optional")})</span>
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TRANSPORT.map((v) => (
            <ChoiceCard
              key={v}
              type="checkbox"
              value={v}
              registration={register("transport")}
              Icon={TRANSPORT_ICONS[v]}
              title={tVol(`availability.transportOptions.${v}`)}
              compact
            />
          ))}
        </div>
      </fieldset>

      <LanguageLevels legend={tVol("languages.title")} register={(lang) => register(`languages.${lang}`)} error={error("languages")} />

      <fieldset>
        <legend className="font-medium text-ink">{tVol("offer.support")}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SUPPORT_TYPES.map((value) => (
            <ChoiceCard
              key={value}
              type="checkbox"
              value={value}
              registration={register("supportTypes")}
              Icon={SUPPORT_ICONS[value]}
              title={tIntake(`support.options.${value}.title`)}
              compact
            />
          ))}
        </div>
        <FieldError message={error("supportTypes")} />
      </fieldset>

      <fieldset>
        <legend className="font-medium text-ink">{tVol("offer.meeting")}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {VOLUNTEER_MEETING_MODES.map((value) => (
            <ChoiceCard
              key={value}
              type="checkbox"
              value={value}
              registration={register("meetingModes")}
              Icon={MEETING_ICONS[value]}
              title={tIntake(`meeting.options.${value}`)}
              compact
            />
          ))}
        </div>
        <FieldError message={error("meetingModes")} />
      </fieldset>

      {result && !result.ok && <Notice role="alert">{t(`errors.${result.reason}`)}</Notice>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={saving} className="pill bg-surface-soft px-5 py-3 text-ink hover:shadow-soft">
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={saving || !isDirty}
          className="pill bg-primary px-5 py-3 text-primary-ink shadow-soft hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
