import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Pages that read the signed-in session. Only these pay for a session refresh. */
const AUTH_PATH = /^\/(he|en)\/(volunteer|admin)(\/|$)/;

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (url && key && AUTH_PATH.test(request.nextUrl.pathname)) {
    // Refresh an expiring session and write the new cookies onto the response.
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  // Run on every path except API routes, Next internals and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
