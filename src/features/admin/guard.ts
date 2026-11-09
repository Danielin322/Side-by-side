import "server-only";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/features/auth/viewer";

/** Signed-out visitors go to sign-in; signed-in non-admins get a 404 so the page isn't advertised. */
export async function requireAdmin(locale: Locale) {
  const viewer = await getViewer();
  if (!viewer) redirect({ href: routes.volunteerLogin, locale });
  if (!viewer!.isAdmin) notFound();
  return viewer!;
}
