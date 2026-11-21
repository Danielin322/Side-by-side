import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";
import { errorMeta, logEvent } from "@/lib/logs";

/**
 * Landing point for links in Supabase emails (confirm address, reset password).
 * Signs the user in, then sends them to `next` (a path on this site only).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "/he/volunteer/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/he/volunteer/dashboard";
  const locale = safeNext.startsWith("/en") ? "en" : "he";

  const supabase = await createSessionClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // If this browser is already signed in as someone else, drop that sign-in first (on this device only).
  // Otherwise leftover pieces of the old sign-in cookie can mix with the new one, and the next page
  // doesn't recognize anyone, so the link looks "expired".
  if (tokenHash && type) await supabase.auth.signOut({ scope: "local" });

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) {
    // Which kind of link it was and why it failed; never the token itself.
    await logEvent({
      severity: "warning",
      category: "auth",
      event: "auth.link_failed",
      message: `Email link could not be used (${type ?? (code ? "code" : "no token")})`,
      metadata: { type, hasCode: !!code, hasTokenHash: !!tokenHash, next: safeNext, ...errorMeta(error) },
    });
    return NextResponse.redirect(`${origin}/${locale}/volunteer/login?error=link`);
  }
  return NextResponse.redirect(`${origin}${safeNext}`);
}
