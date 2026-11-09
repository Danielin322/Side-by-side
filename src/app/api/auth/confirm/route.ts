import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";

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

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(`${origin}/${locale}/volunteer/login?error=link`);
  return NextResponse.redirect(`${origin}${safeNext}`);
}
