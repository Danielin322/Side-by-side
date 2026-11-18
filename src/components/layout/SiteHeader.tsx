import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { HELPLINE_TEL, routes } from "@/lib/routes";
import { LogoMark } from "@/components/brand/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ChatComingSoon } from "./ChatComingSoon";
import { MainNav } from "./MainNav";
import { HideInVolunteerArea } from "./HideInVolunteerArea";

/**
 * Utility bar (brand at the start, quick support at the end) and main navigation.
 * "start"/"end" mirror automatically: in Hebrew the brand sits on the right.
 */
export function SiteHeader() {
  const t = useTranslations();

  return (
    <header className="bg-bg">
      <div className="border-b border-line/60">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
          <Link href={routes.home} aria-label={t("brand.homeLink")} className="flex items-center gap-3">
            <LogoMark className="size-11 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-xl font-semibold text-ink">{t("brand.name")}</span>
              <span className="text-sm text-ink-soft">{t("brand.tagline")}</span>
            </span>
          </Link>

          <div role="group" aria-label={t("topBar.label")} className="flex flex-wrap items-center gap-2">
            {/* Help-seeker shortcuts: not shown on the volunteer dashboard. */}
            <HideInVolunteerArea>
              <a
                href={`tel:${HELPLINE_TEL}`}
                className="pill bg-secondary-soft text-ink hover:shadow-soft"
              >
                <Phone aria-hidden className="size-4 text-secondary" />
                <span>
                  {t("topBar.helpline")}: <span dir="ltr">{t("topBar.helplineNumber")}</span>
                </span>
              </a>
              <ChatComingSoon />
            </HideInVolunteerArea>
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <MainNav />
    </header>
  );
}
