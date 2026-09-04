import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

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

/**
 * Our Clerk instance's Frontend API origin, which is also the `iss` on every
 * session token it mints.
 *
 * A publishable key is `pk_test_` or `pk_live_` followed by the base64 of that
 * host with a `$` terminator — public by construction, which is what makes
 * reading it here reasonable rather than a secret leaking into middleware.
 */
function clerkIssuer(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (key === undefined) return null;

  try {
    const host = atob(key.replace(/^pk_(test|live)_/, "")).replace(/\$$/, "");
    return host.length > 0 ? `https://${host}` : null;
  } catch {
    return null;
  }
}

/** The claims of a JWT, *unverified*. See the caller for why that is allowed. */
function peekClaims(token: string): { iss?: unknown; exp?: unknown } | null {
  const payload = token.split(".")[1];
  if (payload === undefined) return null;

  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json === "object" && json !== null ? json : null;
  } catch {
    return null;
  }
}

/**
 * Does the browser hold a live session token issued by *our* Clerk instance?
 *
 * Read without verifying, and that is safe here because of what the answer is
 * used for: not to let anyone in, only to tell two different failures apart.
 * Forging a "yes" buys an attacker a 503 instead of a redirect to a sign-in page
 * they could have visited anyway.
 *
 * The instance check is the part that has to be exact. A developer machine
 * accumulates `__session` and `__client_uat` cookies from every Clerk app ever
 * run on `localhost`, so "is any Clerk cookie present" is true even for someone
 * who has genuinely signed out of this app — and answering 503 to a signed-out
 * student instead of showing them the sign-in page would be a worse bug than the
 * one this function exists to catch. Matching `iss` against our own publishable
 * key ignores every other instance's cookies.
 *
 * The expiry check matters for the same reason. An expired token is Clerk's
 * handshake to refresh, not a verification failure, and clerkMiddleware has
 * already handled it by the time this runs.
 */
function browserHoldsOurSession(request: NextRequest): boolean {
  const issuer = clerkIssuer();
  if (issuer === null) return false;

  const nowSeconds = Date.now() / 1000;

  return request.cookies.getAll().some((cookie) => {
    if (cookie.name !== "__session" && !cookie.name.startsWith("__session_")) return false;

    const claims = peekClaims(cookie.value);
    return (
      claims !== null &&
      claims.iss === issuer &&
      typeof claims.exp === "number" &&
      claims.exp > nowSeconds
    );
  });
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
    // ── The loop that has to be broken ──────────────────────────────────────
    //
    // Getting here with a browser that thinks it *is* signed in means the two
    // halves of Clerk disagree: the session is live in the browser, and this
    // server could not confirm it. Clerk's own handshake has already had its
    // chance by this point — if a stale cookie were the problem, clerkMiddleware
    // would have returned a handshake redirect instead of falling through to
    // here. So the remaining explanations are all server-side: Clerk's JWKS
    // unreachable, a secret key that belongs to a different instance, an
    // outbound network the process does not actually have.
    //
    // Sending that browser to `/sign-in` is the worst available move. Clerk's
    // <SignIn/> refuses to render for a signed-in user and redirects onward, the
    // next request arrives here in the same state, and the student watches a
    // blank page flicker forever with nothing written down anywhere. Failing
    // loudly once is strictly better than bouncing quietly for ever.
    if (browserHoldsOurSession(request)) {
      console.error(
        `[auth] Session present in the browser but unverifiable on the server (${pathname}). ` +
          `Check that this process can reach Clerk's JWKS and that CLERK_SECRET_KEY ` +
          `matches NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.`,
      );
      return new NextResponse(
        "Your session could not be verified right now. This is a problem on our side, " +
          "not with your account — please try again shortly.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

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
