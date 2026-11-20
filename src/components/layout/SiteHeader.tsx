import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { HELPLINE_TEL, routes } from "@/lib/routes";
import { LogoMark } from "@/components/brand/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ChatComingSoon } from "./ChatComingSoon";
import { MainNav } from "./MainNav";
import { HideInVolunteerArea, ShowInVolunteerArea } from "./HideInVolunteerArea";
import { SignOutButton } from "@/features/auth/SignOutButton";

/**
 * Utility bar (brand at the start, quick support at the end) and main navigation.
 * "start"/"end" mirror automatically: in Hebrew the brand sits on the right.
 * The language switcher is the exception: it stays in the top-right corner in both languages,
 * so it doesn't jump out from under the cursor when the language changes.
 */
export function SiteHeader() {
  const t = useTranslations();

  return (
    <header className="bg-bg">
      <div className="border-b border-line/60">
        <div className="container-page flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
          <Link href={routes.home} aria-label={t("brand.homeLink")} className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <LogoMark className="size-11 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-xl font-semibold text-ink">{t("brand.name")}</span>
              <span className="text-sm text-ink-soft">{t("brand.tagline")}</span>
            </span>
          </Link>

          <div role="group" aria-label={t("topBar.label")} className="order-2 flex basis-full flex-wrap items-center gap-2 lg:ms-auto lg:basis-auto">
            {/* Help-seeker shortcuts: not shown on the volunteer dashboard or in the admin area. */}
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
            {/* Signed-in pages only: the dashboard and the admin area. */}
            <ShowInVolunteerArea>
              <SignOutButton />
            </ShowInVolunteerArea>
          </div>

          {/* Always the physical right edge of the first row. Hebrew: first item (right edge in RTL).
              English: next to the brand on small screens (support buttons wrap below), last on wide ones. */}
          <div className="self-start lg:self-center rtl:order-first ltr:order-1 ltr:ms-auto ltr:lg:order-3 ltr:lg:ms-0">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <MainNav />
    </header>
  );
}
