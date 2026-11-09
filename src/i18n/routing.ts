import { defineRouting } from "next-intl/routing";

/** Supported languages. Hebrew is the default and renders right-to-left. */
export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
});

export type Locale = (typeof routing.locales)[number];

/** Text direction for each locale, used on <html dir>. */
export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  en: "ltr",
};
