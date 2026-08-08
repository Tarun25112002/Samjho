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
]);

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();

  if (token === null) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Your session has expired. Please sign in again.",
          requestId: "bff",
        },
      },
      { status: 401 },
    );
  }

  const target = new URL(`/api/v1/${path.join("/")}`, serverEnv.API_URL);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const response = await fetch(target, {
    method: request.method,
    headers,
    ...(hasBody ? { body: await request.text() } : {}),
    // Never cache a proxied response: these are per-user by definition, and a
    // shared cache here would serve one student another's data.
    cache: "no-store",
  });

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
