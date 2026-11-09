/**
 * Single source of truth for app routes (see PRD §5).
 * Navigation components read from here so labels/paths stay consistent.
 */
export const routes = {
  home: "/",
  askForHelp: "/ask-for-help",
  volunteer: "/volunteer",
  volunteerDashboard: "/volunteer/dashboard",
  guide: "/guide",
  terms: "/terms",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

/** Primary navigation shown in the site header. */
export const mainNav: { href: AppRoute; label: string }[] = [
  { href: routes.home, label: "Home" },
  { href: routes.askForHelp, label: "Get support" },
  { href: routes.volunteer, label: "Volunteer" },
  { href: routes.guide, label: "Rights guide" },
];
