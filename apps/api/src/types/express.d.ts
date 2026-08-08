import type { AuthenticatedUser } from "../modules/auth/auth.service.js";
import type { VerifiedToken } from "../lib/token-verifier.js";

/**
 * Attach our own properties to Express' `Request`.
 *
 * Both are optional, and that is deliberate rather than an oversight. Declaring
 * them as required would be a lie the compiler helps tell: `req.user` genuinely
 * is absent on every public route, and a type that claims otherwise makes
 * "forgot to add requireAuth" invisible until it crashes.
 *
 * Handlers should read them through `getAuth()` / `getAuthUser()` in
 * middleware/auth.ts, which turn the absence into a 401 instead of a
 * `TypeError` on undefined.
 */
declare global {
  namespace Express {
    interface Request {
      /** Verified token claims. Set by `requireAuth`. */
      auth?: VerifiedToken;
      /** Our own user row. Set by `loadUser`, which requires `requireAuth`. */
      user?: AuthenticatedUser;
    }
  }
}

export {};
