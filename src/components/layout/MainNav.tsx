"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { mainNav, routes } from "@/lib/routes";
import { useInVolunteerArea } from "./HideInVolunteerArea";

/**
 * Whether a Supabase session cookie is present. Only used to hide the "I want to volunteer"
 * pill from people who are already signed in; nothing is protected by it.
 * Checking in the browser keeps every page statically rendered.
 */
function hasSessionCookie() {
  return document.cookie.split("; ").some((c) => /^sb-[^=]+-auth-token(\.\d+)?=/.test(c));
}

/** Main menu tabs plus the highlighted volunteer pill (hidden once signed in). Collapses into a menu on small screens. */
export function MainNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const [signedIn, setSignedIn] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  // Re-check on every navigation, so the pill hides right after signing in and returns after signing out.
  useEffect(() => setSignedIn(hasSessionCookie()), [pathname]);

  // The public site's menu isn't relevant on the volunteer dashboard or in the admin area.
  const inVolunteerArea = useInVolunteerArea();
  if (inVolunteerArea) return null;

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

  const volunteerPill = signedIn ? null : (
    <Link
      href={routes.volunteer}
      className="pill bg-primary px-4 py-2.5 text-primary-ink shadow-soft hover:bg-primary-hover sm:px-5 sm:text-base"
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
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 xl:hidden">
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
