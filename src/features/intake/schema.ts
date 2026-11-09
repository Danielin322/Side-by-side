import { z } from "zod";

/** Option values match the CHECK constraints in supabase/migrations/0001_help_requests.sql. */
export const SUPPORT_TYPES = [
  "documents",
  "rights",
  "co_typing",
  "scheduling",
  "calls",
  "accompaniment",
  "follow_up",
] as const;
export const MEETING_MODES = ["in_person", "video", "phone", "any"] as const;
export const LANGUAGES = ["he", "ar", "ru", "en"] as const;

export type SupportType = (typeof SUPPORT_TYPES)[number];
export type MeetingMode = (typeof MEETING_MODES)[number];
export type Language = (typeof LANGUAGES)[number];

/** Each language shown in its own script, so it reads the same in every UI locale. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  he: "עברית",
  ar: "العربية",
  ru: "Русский",
  en: "English",
};

/**
 * Normalizes an Israeli phone number to local format (e.g. 0521234567).
 * Accepts spaces, dashes, brackets and a +972 / 972 prefix. Returns null if invalid.
 */
export function normalizeIsraeliPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+972")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  // Mobile and VoIP: 05X / 07X + 7 digits. Landline: 02/03/04/08/09 + 7 digits.
  if (/^0[57]\d{8}$/.test(digits) || /^0[23489]\d{7}$/.test(digits)) return digits;
  return null;
}

/**
 * Error messages are translation keys under "intake.errors", resolved in the UI.
 * The same schema validates on the client (per step) and again on the server.
 */
const baseSchema = z.object({
    supportTypes: z.array(z.enum(SUPPORT_TYPES)).min(1, "supportRequired"),
    meetingMode: z.enum(MEETING_MODES, "meetingRequired"),
    city: z.string().trim().max(80, "tooLong"),
    language: z.enum(LANGUAGES, "languageRequired"),
    note: z.string().trim().max(500, "noteTooLong"),
    firstName: z.string().trim().min(1, "firstNameRequired").max(60, "tooLong"),
    lastName: z.string().trim().min(1, "lastNameRequired").max(60, "tooLong"),
    phone: z
      .string()
      .trim()
      .min(1, "phoneRequired")
      .refine((v) => normalizeIsraeliPhone(v) !== null, "phoneInvalid"),
    email: z.union([z.literal(""), z.string().trim().max(254, "tooLong").pipe(z.email("emailInvalid"))]),
    scopeAgreed: z.literal(true, "scopeRequired"),
});

const cityFields = baseSchema.pick({ meetingMode: true, city: true });

export const intakeSchema = baseSchema.refine((d) => d.meetingMode !== "in_person" || d.city.length > 0, {
  message: "cityRequired",
  path: ["city"],
  // Check as soon as meeting mode and city are valid, even while later steps are still empty.
  when: (payload) => cityFields.safeParse(payload.value).success,
});

export type IntakeValues = z.input<typeof intakeSchema>;
