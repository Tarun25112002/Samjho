import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";

/**
 * The BFF: a thin same-origin proxy from the browser to the Express API.
 *
 * ## Why this exists at all
 *
 * A Client Component could call Express directly with a token from
 * `useAuth().getToken()`. Three reasons not to:
 *
 *  1. **The token never enters application JavaScript.** It is attached here, on
 *     the server, from the session cookie. Nothing in the bundle can read it,
 *     log it, or accidentally put it in an error report.
 *  2. **Same origin.** No CORS preflight on every mutation, and cookies behave
 *     normally.
 *  3. **Streaming has somewhere to live.** The AI tutor's SSE responses need a
 *     same-origin endpoint (Phase 7); establishing the seam now means that lands
 *     as a handler rather than an architecture change.
 *
 * ## What it must never become
 *
 * A place where logic accumulates. It forwards a request and returns a response.
 * The moment it starts deciding things, there are two APIs to keep correct — and
 * the one nobody is testing is this one.
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  // Never forwarded: the API authenticates by bearer token, and passing the
  // session cookie onward would hand it a credential it has no business seeing.
  "cookie",
  // Overwritten below with the real token.
  "authorization",

  // ── Headers the API trusts, and the browser therefore must not set ────────
  //
  // apps/api runs with `trust proxy: 1`, which means it believes these when
  // deciding what `req.ip` is — and `req.ip` is what rate limiting keys on. A
  // forwarded `x-forwarded-for` would let any signed-in student pick their own
  // apparent IP and make a per-IP limit meaningless. The real proxy in front of
  // the API sets these; this one has no business speaking for it.
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "forwarded",
  // Assigned by the API per request. Accepting one from the browser lets a
  // caller stamp their own requests with somebody else's trace id.
  "x-request-id",
]);

/**
 * Methods that may change something, and therefore need an origin check.
 *
 * The BFF attaches a real bearer token to whatever arrives here, using nothing
 * but the session cookie to decide who the caller is. That is the exact shape of
 * a CSRF sink: a form on another site posts to `/api/v1/…`, the browser attaches
 * our cookie, and this route helpfully upgrades it to an authenticated call.
 *
 * Clerk's session cookie is `SameSite=Lax` today, which already blocks it — but
 * that is a property of Clerk's configuration, not of this file, and it changes
 * to `None` the day the app grows a satellite domain. A same-origin check here
 * does not depend on anyone else's cookie settings.
 *
 * GET and HEAD are excluded deliberately: they change nothing, and a top-level
 * navigation legitimately arrives with no `origin` at all.
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Confine the proxied path to the API's `/api/v1` namespace.
 *
 * `new URL("/api/v1/" + segments.join("/"), base)` resolves `..` the way a
 * browser does, so a segment of `..` climbs out of the versioned prefix and can
 * address anything else the API serves — `/webhooks/clerk`, most pointedly,
 * which is an unauthenticated write path guarded by a signature this proxy would
 * be happy to forward. Next normalises most of these away before routing, but
 * "most" is not a security property, and percent-encoded variants are exactly
 * the ones that survive normalisation.
 *
 * So rather than sanitising, the segments are required to be ordinary path
 * segments and rejected otherwise. Nothing legitimate is turned away: every real
 * route in this API is made of identifiers and slugs.
 */
const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

function isSafePath(segments: string[]): boolean {
  if (segments.length === 0 || segments.length > 12) return false;
  return segments.every(
    (segment) =>
      segment !== "." && segment !== ".." && segment.length <= 200 && SAFE_SEGMENT.test(segment),
  );
}

function fail(status: number, code: string, message: string): Response {
  return NextResponse.json({ error: { code, message, requestId: "bff" } }, { status });
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (!isSafePath(path)) {
    return fail(404, "NOT_FOUND", "No such endpoint.");
  }

  if (MUTATING_METHODS.has(request.method)) {
    // `origin` is set by the browser on every cross-origin request and cannot be
    // spoofed by page JavaScript, which is what makes it worth checking. A
    // missing one on a mutation means a non-browser client; those should be
    // talking to the API directly with their own token, not through the BFF.
    const origin = request.headers.get("origin");
    if (origin === null || origin !== request.nextUrl.origin) {
      return fail(403, "FORBIDDEN", "Cross-origin request refused.");
    }
  }

  let token: string | null;
  try {
    const { getToken } = await auth();
    token = await getToken();
  } catch (error) {
    // `getToken()` talks to Clerk whenever the cookie's token needs refreshing,
    // so it fails when Clerk does. That is a 503 and not a 401, for the same
    // reason it is on the API side: a sign-in page cannot fix an unreachable
    // identity provider, so a 401 here only bounces the browser in a circle.
    console.error("BFF could not obtain a session token", error);
    return fail(503, "SERVICE_UNAVAILABLE", "Sign-in is temporarily unavailable.");
  }

  if (token === null) {
    return fail(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  }

  const target = new URL(`/api/v1/${path.join("/")}`, serverEnv.API_URL);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      ...(hasBody ? { body: await request.text() } : {}),
      // Never cache a proxied response: these are per-user by definition, and a
      // shared cache here would serve one student another's data.
      cache: "no-store",
    });
  } catch (error) {
    // The API being down is not a 500 in *this* app. Answering in the shared
    // error envelope means the client's single error handler works here too,
    // rather than meeting Next's HTML error page inside a JSON parser.
    console.error("BFF could not reach the API", error);
    return fail(503, "SERVICE_UNAVAILABLE", "Samjho is temporarily unavailable.");
  }

  // Status and body pass through untouched, so the client's single error handler
  // sees exactly what Express said — including the requestId a student can quote.
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
      ...(response.headers.get("x-request-id")
        ? { "x-request-id": response.headers.get("x-request-id") as string }
        : {}),
    },
  });
}

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: Context): Promise<Response> {
  const { path } = await context.params;
  return proxy(request, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;

/** Per-user and never static. */
export const dynamic = "force-dynamic";
