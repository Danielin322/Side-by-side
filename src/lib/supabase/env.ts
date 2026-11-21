/**
 * The project address from SUPABASE_URL, cleaned up: surrounding spaces, a trailing slash and an
 * API path copied from the dashboard ("…supabase.co/rest/v1/") are removed. The Supabase client adds
 * its own paths, so a leftover "/rest/v1" would make every request a 404.
 * Plain module (no "server-only") so the middleware can use it too.
 */
export function supabaseUrl(): string | undefined {
  const raw = process.env.SUPABASE_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, "");
}
