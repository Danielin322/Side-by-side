"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/**
 * True on the volunteer dashboard and the admin area, where the public site's menu and
 * help-seeker shortcuts don't apply.
 */
export function useInVolunteerArea() {
  const path = usePathname();
  return path.startsWith(routes.volunteerDashboard) || path === routes.admin || path.startsWith(`${routes.admin}/`);
}

/** Renders its children everywhere except the volunteer dashboard and the admin area. */
export function HideInVolunteerArea({ children }: { children: ReactNode }) {
  return useInVolunteerArea() ? null : children;
}

/** Renders its children only on the volunteer dashboard and in the admin area (signed-in pages). */
export function ShowInVolunteerArea({ children }: { children: ReactNode }) {
  return useInVolunteerArea() ? children : null;
}
