import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import "../globals.css";
import { routing, localeDirection } from "@/i18n/routing";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AccessibilityPanel } from "@/components/a11y/AccessibilityPanel";
import { A11Y_INIT_SCRIPT } from "@/components/a11y/preferences";
import { THEME_INIT_SCRIPT } from "@/components/layout/theme";

// Rubik covers both Hebrew and Latin with soft, rounded letterforms.
const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-rubik",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  const locale = await resolveLocale(props);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  ...props
}: LocaleParams & { children: React.ReactNode }) {
  const locale = await resolveLocale(props);

  return (
    // suppressHydrationWarning: the init scripts set accessibility and theme data-* attributes before React loads.
    <html lang={locale} dir={localeDirection[locale]} className={rubik.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <AccessibilityPanel />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
