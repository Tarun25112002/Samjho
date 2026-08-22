import { meResponseSchema, type MeResponse } from "@samjho/contracts";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * Load the signed-in user's record, or send them somewhere they can be.
 *
 * Every guarded page needs the same three facts — who are you, what role, have
 * you onboarded — and all three arrive in one call. Centralising it here means
 * the redirect rules exist once rather than being re-derived per page, which is
 * how `/welcome` and `/home` end up bouncing off each other.
 *
 * These helpers are the *second* line of defence. `proxy.ts` has already turned
 * away anonymous browsers; if a request reaches here without a session, the API
 * answers 401 and this throws rather than rendering an empty shell.
 */

/**
 * Never cached *across* requests — role, status and onboarding state all change
 * under the user, and a stale answer here is a student stuck in a redirect.
 *
 * Memoised *within* a request by React's `cache()`, though, because both the
 * `(app)` layout and the page inside it need it. Next's own fetch deduplication
 * does not apply once `cache: "no-store"` is set, so without this the shell and
 * its page would each make the call.
 */
export const loadMe = cache(async function loadMe(): Promise<MeResponse> {
  return apiFetchAuthed("/api/v1/me", meResponseSchema, { cache: "no-store" });
});

/**
 * For pages inside the app shell. Guarantees an onboarded user, or redirects.
 *
 * `redirect()` throws a special error that Next unwinds — so nothing after this
 * call runs, and the return type can honestly promise a profile.
 */
export async function requireOnboarded(): Promise<MeResponse> {
  const me = await loadMe();
  if (!me.onboarded) redirect("/welcome");
  return me;
}

/** Roles allowed to author content. Mirrors the API's `requireRole` on those routes. */
const CONTENT_ROLES = new Set(["ADMIN", "CONTENT_EDITOR"]);

/**
 * For the admin area. Not an authorization control — the API is.
 *
 * Worth being explicit about, because a role check in a React tree looks exactly
 * like one. Every `/admin/*` request the browser makes goes through the BFF to
 * Express, which checks the role again from our own database on every call. This
 * check exists so a student who guesses the URL sees "not found" instead of an
 * admin shell full of buttons that 403, and so the nav can be rendered honestly.
 *
 * `notFound()` rather than a redirect: the existence of the admin area is not
 * something a student needs confirmed, and there is nowhere useful to send them.
 */
export async function requireContentRole(): Promise<MeResponse> {
  const me = await requireOnboarded();
  if (!CONTENT_ROLES.has(me.user.role)) notFound();
  return me;
}
