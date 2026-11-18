"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/** True on the volunteer dashboard, where the public site's menu and help-seeker shortcuts don't apply. */
export function useInVolunteerArea() {
  return usePathname().startsWith(routes.volunteerDashboard);
}

/** Renders its children everywhere except the volunteer dashboard. */
export function HideInVolunteerArea({ children }: { children: ReactNode }) {
  return useInVolunteerArea() ? null : children;
}
