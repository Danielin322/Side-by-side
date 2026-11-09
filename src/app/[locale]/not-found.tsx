import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <section className="container-page py-24 text-center">
      <h1 className="text-3xl font-semibold text-ink">{t("title")}</h1>
      <Link href={routes.home} className="btn-secondary mt-8 inline-flex">
        {t("back")}
      </Link>
    </section>
  );
}
