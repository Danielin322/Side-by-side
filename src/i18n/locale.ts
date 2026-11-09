import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "./routing";

export type LocaleParams = { params: Promise<{ locale: string }> };

/**
 * Reads the [locale] segment, 404s on unknown locales, and enables static rendering.
 * Call at the top of every page and layout under app/[locale].
 */
export async function resolveLocale({ params }: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
