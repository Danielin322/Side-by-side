import "server-only";
import { headers } from "next/headers";

/** This site's origin (e.g. http://localhost:3000), for links inside Supabase emails. */
export async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
