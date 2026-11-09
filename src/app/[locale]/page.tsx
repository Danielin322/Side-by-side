import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardPen,
  Handshake,
  HeartHandshake,
  MessageCircleHeart,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale, type LocaleParams } from "@/i18n/locale";
import { routes } from "@/lib/routes";
import { HeroIllustration } from "@/components/home/HeroIllustration";

const STEPS: { key: "one" | "two" | "three"; Icon: LucideIcon }[] = [
  { key: "one", Icon: MessageCircleHeart },
  { key: "two", Icon: HeartHandshake },
  { key: "three", Icon: ClipboardCheck },
];

export default async function HomePage(props: LocaleParams) {
  await resolveLocale(props);
  const t = await getTranslations("home");

  return (
    <>
      {/* Hero: text at the start, illustration at the end (mirrors in Hebrew). */}
      <section className="container-page grid items-center gap-12 pt-10 pb-20 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-28">
        <div>
          <h1 className="text-4xl font-semibold leading-tight text-balance text-ink sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            {t("hero.subtitle")}
          </p>

          <div className="mt-10 grid gap-4 sm:max-w-xl">
            <CtaCard
              href={routes.askForHelp}
              Icon={ClipboardPen}
              title={t("hero.ctaHelp")}
              hint={t("hero.ctaHelpHint")}
              variant="primary"
            />
            <CtaCard
              href={routes.volunteer}
              Icon={Handshake}
              title={t("hero.ctaVolunteer")}
              hint={t("hero.ctaVolunteerHint")}
              variant="secondary"
            />
          </div>
        </div>

        <HeroIllustration className="mx-auto w-full max-w-md lg:max-w-none" />
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-6 bg-surface-soft py-20 sm:py-24">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 id="how-it-works-title" className="text-3xl font-semibold text-ink sm:text-4xl">
              {t("steps.title")}
            </h2>
            <p className="mt-3 text-lg text-ink-soft">{t("steps.intro")}</p>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ key, Icon }, i) => (
              <li key={key} className="rounded-3xl bg-surface p-7 shadow-soft">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft">
                  <Icon aria-hidden className="size-7 text-primary" strokeWidth={1.75} />
                </span>
                <p className="mt-6 text-sm font-medium text-secondary">{t("steps.step", { number: i + 1 })}</p>
                <h3 className="mt-1 text-xl font-semibold text-ink">{t(`steps.${key}.title`)}</h3>
                <p className="mt-2 text-ink-soft">{t(`steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

function CtaCard({
  href,
  Icon,
  title,
  hint,
  variant,
}: {
  href: string;
  Icon: LucideIcon;
  title: string;
  hint: string;
  variant: "primary" | "secondary";
}) {
  const primary = variant === "primary";
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-3xl p-5 shadow-soft transition-shadow hover:shadow-lifted sm:p-6 ${
        primary ? "bg-primary text-primary-ink" : "bg-surface text-ink"
      }`}
    >
      <span
        className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${
          primary ? "bg-primary-ink/15" : "bg-secondary-soft"
        }`}
      >
        <Icon aria-hidden className={`size-7 ${primary ? "" : "text-secondary"}`} strokeWidth={1.75} />
      </span>
      <span className="flex-1">
        <span className="block text-lg font-semibold sm:text-xl">{title}</span>
        <span className={`block text-sm ${primary ? "opacity-90" : "text-ink-soft"}`}>{hint}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="size-6 shrink-0 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
      />
    </Link>
  );
}
