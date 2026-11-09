"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const LANGS: { locale: Locale; label: string; full: string }[] = [
  { locale: "en", label: "EN", full: "English" },
  { locale: "he", label: "עב", full: "עברית" },
];

/** Minimal "EN | עב" switcher that keeps the visitor on the same page. */
export function LanguageSwitcher() {
  const t = useTranslations("topBar");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("language")} className="flex items-center gap-1 text-sm" dir="ltr">
      {LANGS.map(({ locale, label, full }, i) => (
        <span key={locale} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-line">|</span>}
          <Link
            href={pathname}
            locale={locale}
            lang={locale}
            aria-label={full}
            aria-current={current === locale ? "true" : undefined}
            className={`rounded-full px-2.5 py-1.5 ${
              current === locale ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
