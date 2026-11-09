import "server-only";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = () => process.env.SUPABASE_URL;
const publishableKey = () => process.env.SUPABASE_PUBLISHABLE_KEY;

/**
 * Anonymous client with the publishable key, no session.
 * Used by the help-request form, which can only call submit_help_request().
 * Returns null when env vars aren't set, so the app still runs without a project.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url() || !publishableKey()) return null;
  return createClient(url()!, publishableKey()!, { auth: { persistSession: false } });
}

/**
 * Client acting as the signed-in user, with the session stored in cookies.
 * Row Level Security decides what this user may read or change.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(url()!, publishableKey()!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The middleware refreshes them.
        }
      },
    },
  });
}

/**
 * Server-only client with the secret key. Bypasses Row Level Security, so use it only for
 * operations a visitor cannot do as themselves (creating a volunteer application at sign-up).
 */
export function createAdminClient(): SupabaseClient | null {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url() || !secret) return null;
  return createClient(url()!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The signed-in user (verified with Supabase), or null. */
export async function getCurrentUser() {
  if (!url() || !publishableKey()) return null;
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
