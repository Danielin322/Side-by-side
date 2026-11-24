import { z } from "zod";
import { ageFromIsoDate, normalizeIsraeliId, normalizeIsraeliPhone } from "@/lib/validation";
import { SUPPORT_TYPES } from "@/features/intake/schema";

/** Values match the CHECK constraints in supabase/migrations/0002_volunteers.sql. */
export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const SLOTS = ["morning", "afternoon", "evening"] as const;
export const TRANSPORT = ["license", "car", "public_transit"] as const;
export const VOLUNTEER_MEETING_MODES = ["in_person", "video", "phone"] as const;
export const VOLUNTEER_LANGUAGES = ["he", "ar", "ru", "en", "am", "fr", "es"] as const;
export const LANGUAGE_LEVELS = ["basic", "good", "native"] as const;
export const VOLUNTEER_STATUSES = ["applied", "interview", "approved", "not_approved"] as const;

export type VolunteerLanguage = (typeof VOLUNTEER_LANGUAGES)[number];
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];
export type VolunteerStatus = (typeof VOLUNTEER_STATUSES)[number];

/** Each language in its own script. */
export const VOLUNTEER_LANGUAGE_NAMES: Record<VolunteerLanguage, string> = {
  he: "עברית",
  ar: "العربية",
  ru: "Русский",
  en: "English",
  am: "አማርኛ",
  fr: "Français",
  es: "Español",
};

const AVAILABILITY_SLOTS = DAYS.flatMap((d) => SLOTS.map((s) => `${d}_${s}` as const));
const level = z.enum([...LANGUAGE_LEVELS, ""]);

/** Error messages are translation keys under "volunteer.errors". */
const baseSchema = z.object({
  fullName: z.string().trim().min(2, "fullNameRequired").max(100, "tooLong"),
  nationalId: z
    .string()
    .trim()
    .min(1, "idRequired")
    .refine((v) => normalizeIsraeliId(v) !== null, "idInvalid"),
  birthDate: z
    .string()
    .min(1, "birthDateRequired")
    .refine((v) => {
      const age = ageFromIsoDate(v);
      return age !== null && age <= 110;
    }, "birthDateInvalid")
    .refine((v) => (ageFromIsoDate(v) ?? 0) >= 18, "tooYoung"),
  city: z.string().trim().min(1, "cityRequired").max(80, "tooLong"),
  phone: z
    .string()
    .trim()
    .min(1, "phoneRequired")
    .refine((v) => normalizeIsraeliPhone(v) !== null, "phoneInvalid"),
  occupation: z.string().trim().max(120, "tooLong"),
  availability: z.array(z.enum(AVAILABILITY_SLOTS)).min(1, "availabilityRequired"),
  commitSixMonths: z.enum(["yes", "no"], "commitRequired"),
  transport: z.array(z.enum(TRANSPORT)),
  languages: z
    .object(Object.fromEntries(VOLUNTEER_LANGUAGES.map((l) => [l, level])) as Record<VolunteerLanguage, typeof level>)
    .refine((langs) => Object.values(langs).some((v) => v !== ""), "languageRequired"),
  supportTypes: z.array(z.enum(SUPPORT_TYPES)).min(1, "supportRequired"),
  meetingModes: z.array(z.enum(VOLUNTEER_MEETING_MODES)).min(1, "meetingModesRequired"),
  experience: z.string().trim().max(1000, "tooLong"),
  motivation: z.string().trim().min(20, "motivationShort").max(1000, "tooLong"),
  skills: z.string().trim().max(500, "tooLong"),
  backgroundConsent: z.literal(true, "consentRequired"),
  conductAgreed: z.literal(true, "conductRequired"),
  email: z.string().trim().min(1, "emailRequired").max(254, "tooLong").pipe(z.email("emailInvalid")),
  password: z.string().min(8, "passwordShort").max(72, "tooLong"),
  passwordConfirm: z.string().min(1, "passwordConfirmRequired"),
});

const passwordFields = baseSchema.pick({ password: true, passwordConfirm: true });

export const volunteerSchema = baseSchema.refine((d) => d.password === d.passwordConfirm, {
  message: "passwordMismatch",
  path: ["passwordConfirm"],
  when: (payload) => passwordFields.safeParse(payload.value).success,
});

export type VolunteerValues = z.input<typeof volunteerSchema>;

/** An admin filling in their own volunteer profile: the application without the account step. */
export const adminVolunteerSchema = baseSchema.omit({ email: true, password: true, passwordConfirm: true });
export type AdminVolunteerValues = z.input<typeof adminVolunteerSchema>;

export const DEFAULT_LANGUAGES = Object.fromEntries(VOLUNTEER_LANGUAGES.map((l) => [l, ""])) as Record<
  VolunteerLanguage,
  ""
>;

/** The parts of the profile a volunteer can edit from their dashboard (see update_my_volunteer_profile()). */
export const profileSchema = baseSchema.pick({
  phone: true,
  city: true,
  occupation: true,
  availability: true,
  transport: true,
  languages: true,
  supportTypes: true,
  meetingModes: true,
});

export type ProfileValues = z.input<typeof profileSchema>;

/** Stored as [{ code, level }]; the form uses one radio group per language. */
export type StoredLanguage = { code: string; level: string };

export function languagesToForm(stored: StoredLanguage[]): ProfileValues["languages"] {
  const form: Record<VolunteerLanguage, "" | LanguageLevel> = { ...DEFAULT_LANGUAGES };
  for (const { code, level } of stored) {
    if ((VOLUNTEER_LANGUAGES as readonly string[]).includes(code) && (LANGUAGE_LEVELS as readonly string[]).includes(level)) {
      form[code as VolunteerLanguage] = level as LanguageLevel;
    }
  }
  return form;
}

export function languagesFromForm(form: Record<string, string>): StoredLanguage[] {
  return Object.entries(form)
    .filter(([, level]) => level !== "")
    .map(([code, level]) => ({ code, level }));
}
