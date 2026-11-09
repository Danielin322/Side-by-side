/**
 * Single source of truth for app routes (see PRD §5).
 * Paths are locale-free; the Link from "@/i18n/navigation" adds /he or /en.
 */
export const routes = {
  home: "/",
  howItWorks: "/#how-it-works",
  askForHelp: "/ask-for-help",
  volunteer: "/volunteer",
  volunteerLogin: "/volunteer/login",
  volunteerForgot: "/volunteer/forgot-password",
  volunteerReset: "/volunteer/reset-password",
  volunteerDashboard: "/volunteer/dashboard",
  admin: "/admin",
  guide: "/guide",
  terms: "/terms",
  privacy: "/privacy",
  about: "/about",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

/** Main navigation tabs. `labelKey` points into the "nav" messages. */
export const mainNav = [
  { href: routes.howItWorks, labelKey: "howItWorks" },
  { href: routes.guide, labelKey: "guide" },
  { href: routes.volunteerDashboard, labelKey: "volunteerArea" },
  { href: routes.privacy, labelKey: "privacy" },
  { href: routes.about, labelKey: "about" },
] as const;

/** Placeholder helpline. TODO: replace 0000 with the real partner hotline before launch. */
export const HELPLINE_TEL = "0000";
