"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { mainNav, routes } from "@/lib/routes";

/** Main menu tabs plus the highlighted volunteer pill. Collapses into a menu on small screens. */
export function MainNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  const tabs = mainNav.map((item) => {
    const active = !item.href.includes("#") && pathname.startsWith(item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={`block whitespace-nowrap rounded-full px-4 py-2.5 transition-colors ${
            active ? "bg-primary-soft text-ink font-medium" : "text-ink-soft hover:bg-surface-soft hover:text-ink"
          }`}
        >
          {t(item.labelKey)}
        </Link>
      </li>
    );
  });

  const volunteerPill = (
    <Link
      href={routes.volunteer}
      className="pill bg-primary px-5 py-2.5 text-base text-primary-ink shadow-soft hover:bg-primary-hover"
    >
      <Heart aria-hidden className="size-4" />
      {t("volunteerCta")}
    </Link>
  );

  return (
    <nav aria-label={t("label")} className="container-page">
      {/* Desktop */}
      <div className="hidden items-center justify-between gap-6 py-3 xl:flex">
        <ul className="flex flex-wrap items-center gap-1">{tabs}</ul>
        {volunteerPill}
      </div>

      {/* Mobile */}
      <div className="flex items-center justify-between gap-3 py-3 xl:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="pill bg-surface text-ink shadow-soft"
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          {open ? t("closeMenu") : t("openMenu")}
        </button>
        {volunteerPill}
      </div>
      <ul id="mobile-menu" hidden={!open} className="mb-3 space-y-1 rounded-3xl bg-surface p-3 shadow-soft xl:hidden">
        {tabs}
      </ul>
    </nav>
  );
}
