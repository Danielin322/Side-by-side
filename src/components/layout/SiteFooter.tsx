import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { LogoMark } from "@/components/brand/Logo";

export function SiteFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 bg-surface-soft">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-xl items-start gap-3">
          <LogoMark className="size-8 shrink-0" />
          <p className="text-sm text-ink-soft">{t("footer.note")}</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link href={routes.terms} className="font-medium text-ink underline underline-offset-4 decoration-line hover:decoration-ink">
            {t("footer.terms")}
          </Link>
          <span className="text-ink-soft">{t("footer.copyright", { year })}</span>
        </div>
      </div>
    </footer>
  );
}
