import { z } from "zod";
import { normalizeIsraeliPhone } from "@/lib/validation";

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
