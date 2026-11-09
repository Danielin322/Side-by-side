import { getTranslations } from "next-intl/server";
import type { Messages } from "next-intl";

type PageKey = Exclude<keyof Messages["pages"], "stub">;

/** Calm placeholder used by pages that are built in later phases. */
export async function StubPage({ titleKey }: { titleKey: PageKey }) {
  const t = await getTranslations("pages");
  return (
    <section className="container-page py-20 sm:py-28">
      <h1 className="text-3xl sm:text-4xl font-semibold text-ink">{t(titleKey)}</h1>
      <p className="mt-4 text-lg text-ink-soft">{t("stub")}</p>
    </section>
  );
}
