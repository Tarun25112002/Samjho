import type { Role } from "@samjho/contracts";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { ClerkUserError } from "../lib/clerk-user.js";
import { ForbiddenError, ServiceUnavailableError, UnauthenticatedError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { TokenVerificationError, type TokenVerifier } from "../lib/token-verifier.js";
import { authService, type AuthenticatedUser } from "../modules/auth/auth.service.js";
import type { VerifiedToken } from "../lib/token-verifier.js";

/**
 * The three-step authentication chain.
 *
 *   requireAuth  → is this a genuine, unexpired token from our Clerk instance?
 *   loadUser     → who is that in *our* domain, and are they allowed in at all?
 *   requireRole  → may this particular user perform this particular action?
 *
 * They are separate middleware rather than one because each answers a different
 * question and fails with a different status. Merging them produces the classic
 * bug where an expired token and an insufficient role both come back as 403,
 * and the client cannot tell "log in again" from "you will never be allowed".
 *
 * None of this is the last line of defence. Ownership checks live in services
 * (`findFirst({ where: { id, userId } })`), and answer keys are stripped by the
 * serializer. Route-level middleware is the outermost of three layers, not the
 * only one — see docs/02 §4.
 */

const BEARER = /^Bearer (?<token>[\w-]+\.[\w-]+\.[\w-]+)$/;

/**
 * Verify the bearer token and attach its claims.
 *
 * Takes the verifier as an argument rather than importing the singleton so the
 * tests can hand it one backed by a locally generated key set — which means the
 * tests exercise this exact code, rather than a mock shaped like it.
 */
export function requireAuth(verifyToken: TokenVerifier): RequestHandler {
  return async function requireAuthHandler(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if (typeof header !== "string" || header.length === 0) {
      next(new UnauthenticatedError());
      return;
    }

    const token = BEARER.exec(header)?.groups?.["token"];
    if (token === undefined) {
      // Shape-checked before verification so a garbage header costs a regex
      // rather than a JWKS lookup. Note the message says nothing about *why* —
      // "malformed" versus "expired" is a free hint to someone probing.
      next(new UnauthenticatedError());
      return;
    }

    try {
      const claims: VerifiedToken = await verifyToken(token);
      req.auth = claims;
      next();
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        // The reason is logged, never returned. It is exactly the information an
        // attacker would use to work out which part of their forgery to fix.
        logger.debug({ reason: error.reason }, "Rejected session token");
        next(new UnauthenticatedError());
        return;
      }
      next(error);
    }
  };
}

/**
 * Resolve the verified Clerk id to our own user row, creating it if this is the
 * first request from a newly signed-up account.
 *
 * There is no cache here, and that is a decision rather than an omission. The
 * lookup is a single unique-index hit, so caching would save well under a
 * millisecond — while introducing a window in which a suspended account keeps
 * working and a revoked admin role keeps applying. Trading correctness of
 * authorization data for a sub-millisecond saving is a bad trade. If this ever
 * shows up in a profile, the fix is a short-TTL cache with explicit invalidation
 * on role and status writes, added deliberately.
 */
export const loadUser: RequestHandler = async function loadUserHandler(req, _res, next) {
  const auth = getAuth(req);

  let user: AuthenticatedUser;
  try {
    user = await authService.resolveAuthenticatedUser(auth.clerkUserId);
  } catch (error) {
    if (error instanceof ClerkUserError) {
      // The token is valid but Clerk cannot tell us who it belongs to — their
      // API is down, or the account has no email. Neither is the caller's fault,
      // so this is a 503 and not a 401: a 401 would send the web app into a
      // sign-in loop trying to fix a problem that is not theirs.
      logger.error({ err: error, clerkUserId: auth.clerkUserId }, "Could not hydrate Clerk user");
      next(new ServiceUnavailableError("Sign-in is temporarily unavailable. Please try again."));
      return;
    }
    next(error);
    return;
  }

  if (user.status === "SUSPENDED") {
    next(new ForbiddenError("This account has been suspended. Contact support."));
    return;
  }

  if (user.status === "DELETED") {
    // The row survives anonymised, but the person is gone. A live token for a
    // deleted account means Clerk's session outlived the deletion webhook.
    next(new ForbiddenError("This account no longer exists."));
    return;
  }

  req.user = user;
  next();
};

/** `requireAuth` + `loadUser`, in the only order that works. */
export function authenticated(verifyToken: TokenVerifier): RequestHandler[] {
  return [requireAuth(verifyToken), loadUser];
}

/**
 * Restrict a route to specific roles.
 *
 * Reads `req.user.role`, which came from our database — never from a token
 * claim or Clerk metadata. That is the whole reason `User.role` exists as a
 * column (docs/02 §4): an authorization input must have a write path we own.
 */
export function requireRole(...roles: [Role, ...Role[]]): RequestHandler {
  return function requireRoleHandler(req, _res, next) {
    const user = getAuthUser(req);

    if (!roles.includes(user.role)) {
      logger.warn(
        { userId: user.id, role: user.role, required: roles },
        "Blocked a request on role",
      );
      next(new ForbiddenError());
      return;
    }

    next();
  };
}

/**
 * Read the verified claims, or fail closed.
 *
 * The throw is the point. If a route is wired up without `requireAuth`, this
 * turns a silent "everyone is anonymous, carry on" into a 401 — the safe
 * direction to be wrong in.
 */
export function getAuth(req: Request): VerifiedToken {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
}

export function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new UnauthenticatedError();
  return req.user;
}
