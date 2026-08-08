import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. Same file, same position in the
 * request lifecycle — it runs on the edge before any route is matched.
 *
 * ## What this does, and pointedly what it does not
 *
 * This layer decides where an unauthenticated browser gets *sent*. It is a UX
 * concern and nothing more. Every actual authorization decision happens in the
 * Express API, which verifies the bearer token on every request and has never
 * heard of this file (docs/02 §4).
 *
 * That separation is not belt-and-braces caution; it is the only correct model.
 * Middleware runs on requests the browser makes, and an attacker's requests do
 * not have to be browser requests. Anything defended only here is undefended.
 *
 * ## Why the onboarding gate is not here
 *
 * "Not onboarded → /welcome" needs to know whether a `StudentProfile` exists,
 * which lives in our database rather than in the session. Asking the API for it
 * would put a network call in front of *every* request, including static assets
 * that survived the matcher.
 *
 * So that gate lives in the `(app)` layout, which already fetches `/me` to
 * render the shell — the check becomes free. This is also what Clerk now
 * recommends: protect as close to the resource as possible, not in middleware.
 */

/**
 * Paths reachable without a session.
 *
 * `/api` is here on purpose. Those are the BFF route handlers, and redirecting
 * an unauthenticated XHR to an HTML sign-in page produces a fetch that resolves
 * with a 200 full of HTML — which fails somewhere confusing inside a JSON
 * parser. They authenticate themselves and answer 401 like an API should.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/status", "/api"] as const;

/** Exact-match public pages, so `/` does not make everything public. */
const PUBLIC_EXACT = new Set(["/"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const { userId, redirectToSignIn } = await auth();

  // A signed-in user landing on the sign-in page has almost always arrived from
  // a stale bookmark. Sending them onward beats showing a form they cannot use.
  if (userId && (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (!userId && !isPublic(pathname)) {
    // `returnBackUrl` is what makes a deep link survive the sign-in detour —
    // click a shared chapter link, sign in, land on the chapter rather than the
    // dashboard.
    return redirectToSignIn({ returnBackUrl: request.url });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except Next's internals and anything that looks like a static
    // file. Running auth on a font is pure latency.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
