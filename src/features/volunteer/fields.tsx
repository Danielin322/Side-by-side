"use client";

import type { UseFormRegisterReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/form/FormParts";
import { DAYS, LANGUAGE_LEVELS, SLOTS, VOLUNTEER_LANGUAGES, VOLUNTEER_LANGUAGE_NAMES, type VolunteerLanguage } from "./schema";

/**
 * Field groups shared by the volunteer application and the dashboard's profile editor,
 * so both look and behave the same.
 */

/** Weekly grid of day x time-of-day checkboxes. Values look like "sun_morning". */
export function AvailabilityGrid({
  legend,
  registration,
  error,
}: {
  legend: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const t = useTranslations("volunteer");
  return (
    <fieldset>
      <legend className="font-medium text-ink">{legend}</legend>
      <div className="mt-3 overflow-hidden rounded-3xl bg-surface shadow-soft">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-ink-soft">
              <th className="w-1/4 p-3" />
              {SLOTS.map((s) => (
                <th key={s} scope="col" className="p-3 font-medium">
                  {t(`availability.slots.${s}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d} className="border-t border-line/60">
                <th scope="row" className="p-3 text-start font-medium text-ink">
                  {t(`availability.days.${d}`)}
                </th>
                {SLOTS.map((s) => (
                  <td key={s} className="p-1.5 text-center">
                    <label className="block cursor-pointer">
                      <input type="checkbox" value={`${d}_${s}`} {...registration} className="peer sr-only" />
                      <span className="sr-only">
                        {t(`availability.days.${d}`)} {t(`availability.slots.${s}`)}
                      </span>
                      <span
                        aria-hidden
                        className="mx-auto block h-10 rounded-xl bg-surface-soft transition-colors peer-checked:bg-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]"
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

/** One row per language with a level picker: none / basic / good / native. */
export function LanguageLevels({
  legend,
  legendHidden = false,
  register,
  error,
}: {
  legend: string;
  legendHidden?: boolean;
  register: (lang: VolunteerLanguage) => UseFormRegisterReturn;
  error?: string;
}) {
  const t = useTranslations("volunteer");
  return (
    <fieldset>
      <legend className={legendHidden ? "sr-only" : "font-medium text-ink"}>{legend}</legend>
      <div className={`space-y-3 ${legendHidden ? "" : "mt-3"}`}>
        {VOLUNTEER_LANGUAGES.map((lang) => (
          <div key={lang} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <span id={`lang-${lang}`} lang={lang} className="text-lg font-medium text-ink">
              {VOLUNTEER_LANGUAGE_NAMES[lang]}
            </span>
            <div role="radiogroup" aria-labelledby={`lang-${lang}`} className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-soft p-1">
              {(["", ...LANGUAGE_LEVELS] as const).map((lvl) => (
                <label key={lvl || "none"} className="cursor-pointer">
                  <input type="radio" value={lvl} {...register(lang)} className="peer sr-only" />
                  <span className="block rounded-xl px-3 py-2 text-center text-sm text-ink-soft transition-colors peer-checked:bg-surface peer-checked:font-medium peer-checked:text-ink peer-checked:shadow-soft peer-focus-visible:outline-3 peer-focus-visible:outline-[var(--focus)]">
                    {t(`languages.levels.${lvl || "none"}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}
