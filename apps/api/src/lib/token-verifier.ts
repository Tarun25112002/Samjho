import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

import { config } from "./config.js";

/**
 * Session-token verification.
 *
 * ## Why `jose` rather than `@clerk/backend`
 *
 * Clerk ships a `verifyToken()` that would do this in one line. Three reasons
 * not to use it here:
 *
 *  1. **This is the security boundary of the entire product.** Every
 *     authorization decision downstream rests on the claims this function
 *     returns. Code at that position should be readable in full, on one screen,
 *     by whoever inherits it — not delegated to a call whose defaults you would
 *     have to go and look up.
 *  2. **Testability.** `createTokenVerifier` takes a key-resolution function, so
 *     the tests generate a real RSA keypair, sign real tokens, and exercise this
 *     exact code path — no mocking of the thing being tested.
 *  3. **The identity provider stays swappable.** `jose` verifies any RS256 JWT
 *     against any JWKS. Moving off Clerk would change configuration, not this
 *     file.
 *
 * The cost is that Clerk-specific claim handling is ours to get right, which is
 * why each check below says what it is for.
 *
 * ## What a stolen token can still do
 *
 * Verification proves a token was minted by our Clerk instance and has not
 * expired. It does not prove the request came from the person it was minted for.
 * That is inherent to bearer tokens; the mitigations are short expiry (Clerk
 * session tokens live ~60 seconds and are refreshed transparently), HTTPS, and
 * never logging the `authorization` header — all three of which are in place.
 */

/** Claims we actually use. Everything else in the token is deliberately ignored. */
const claimsSchema = z.object({
  /** Clerk's user id, `user_…`. The join key to our own `User.clerkId`. */
  sub: z.string().min(1),
  /** Clerk session id, `sess_…`. Absent on non-session tokens. */
  sid: z.string().min(1).optional(),
  /**
   * Authorized party — the origin the token was minted for. This is the claim
   * that stops a token issued to some other app on the same Clerk instance from
   * being replayed against this API.
   */
  azp: z.string().min(1).optional(),
  exp: z.number(),
});

export interface VerifiedToken {
  clerkUserId: string;
  sessionId: string | null;
  expiresAt: Date;
}

export class TokenVerificationError extends Error {
  constructor(
    message: string,
    /** Short, stable reason for logs. Never sent to the client. */
    readonly reason: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "TokenVerificationError";
  }
}

/**
 * We could not *decide* whether the token is valid, because the key set was
 * unreachable.
 *
 * A separate class because the two failures are not the same event and must not
 * produce the same response. "Your token is bad" is a 401 and tells the browser
 * to go and sign in again. "We cannot reach Clerk" is a 503 and tells it to try
 * later — signing in again cannot possibly help, because signing in also needs
 * the thing that is down.
 *
 * Collapsing the two is not a cosmetic mistake. It produces an infinite loop:
 * every request 401s, the web app sends the student to `/sign-in`, Clerk's
 * component sees a perfectly good session in the browser and bounces them back,
 * forever, with nothing in any log that says why. That loop is the single most
 * expensive failure this file can cause, and this class exists to make it
 * impossible.
 */
export class KeyResolutionError extends Error {
  constructor(
    message: string,
    readonly reason: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "KeyResolutionError";
  }
}

/**
 * jose error codes that mean "the key set could not be obtained or understood",
 * as opposed to "this token failed a check".
 *
 * `ERR_JWKS_NO_MATCHING_KEY` is deliberately *not* here. jose already refetches
 * on an unknown `kid`, so reaching that error means the key genuinely is not in
 * the published set — which is what a forged `kid` looks like, and is the
 * caller's problem. `ERR_JOSE_GENERIC` is: jose raises it for a non-200 or
 * unparseable JWKS response, both of which are Clerk having a bad day.
 */
const KEY_RESOLUTION_CODES = new Set(["ERR_JWKS_TIMEOUT", "ERR_JWKS_INVALID", "ERR_JOSE_GENERIC"]);

/**
 * Does this error mean the key set was unreachable rather than the token bad?
 *
 * Two shapes to recognise. jose's own failures carry a `code`. A transport
 * failure — DNS, a refused connection, a firewall answering EACCES — is not
 * wrapped at all and arrives as `TypeError: fetch failed` with the real syscall
 * error hanging off `cause`. Neither has anything to do with the token, and
 * both used to be reported as "not authenticated".
 */
function isKeyResolutionFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const code: unknown = (error as { code?: unknown }).code;
  if (typeof code === "string" && KEY_RESOLUTION_CODES.has(code)) return true;

  // `fetch` rejects with a TypeError whose `cause` is the underlying system
  // error. A TypeError out of jwtVerify has no other plausible source: every
  // token-shaped failure is a JOSEError subclass.
  return error instanceof TypeError;
}

export type TokenVerifier = (token: string) => Promise<VerifiedToken>;

export interface TokenVerifierOptions {
  /** Key resolver — remote JWKS in production, a local key set in tests. */
  jwks: JWTVerifyGetKey;
  /** Expected `iss`. An exact string match; no prefix or suffix matching. */
  issuer: string;
  /** Origins allowed to have obtained a token. Must not be empty. */
  authorizedParties: string[];
  /**
   * Slack for clock drift between Clerk and this machine, in seconds. Five is
   * enough for NTP-synced hosts and small enough that an expired token is not
   * meaningfully extended. Do not raise this to "fix" a failing test.
   */
  clockToleranceSeconds?: number;
}

export function createTokenVerifier(options: TokenVerifierOptions): TokenVerifier {
  const { jwks, issuer, authorizedParties, clockToleranceSeconds = 5 } = options;

  if (authorizedParties.length === 0) {
    // A caller who passes none has almost certainly mis-wired configuration
    // rather than made a deliberate choice, and the failure would be silent.
    throw new Error("createTokenVerifier requires at least one authorized party");
  }

  return async function verifyToken(token: string): Promise<VerifiedToken> {
    let payload: unknown;

    try {
      // `algorithms` is not optional politeness. Without it, a verifier will
      // accept whatever the token's own header asks for — which is how the
      // classic "alg: none" and RS256-verified-as-HS256 confusion attacks work.
      // Pinning it means the token header cannot influence how it is checked.
      ({ payload } = await jwtVerify(token, jwks, {
        issuer,
        algorithms: ["RS256"],
        clockTolerance: clockToleranceSeconds,
        // jose checks exp/nbf when present; `requiredClaims` makes their
        // *absence* an error too, so a token with no expiry cannot slip through
        // as "never expired".
        requiredClaims: ["sub", "exp", "iat", "nbf"],
      }));
    } catch (error) {
      // Classified before anything else, because the wrong answer here is the
      // one that produces a sign-in loop rather than an error anyone can read.
      if (isKeyResolutionFailure(error)) {
        throw new KeyResolutionError(
          "Could not reach the identity provider's key set",
          "jwks_unreachable",
          { cause: error },
        );
      }

      throw new TokenVerificationError("Session token is not valid", "signature_or_claims", {
        cause: error,
      });
    }

    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new TokenVerificationError("Session token is missing required claims", "claims_shape");
    }

    const claims = parsed.data;

    // `azp` binds a token to the browser Origin that obtained it. Clerk omits
    // it when that Origin is empty, so there is no origin to compare in that
    // case. A present claim must still match exactly: accepting a *wrong* origin
    // would allow a token issued for another frontend to be replayed here.
    if (claims.azp !== undefined && !authorizedParties.includes(claims.azp)) {
      throw new TokenVerificationError(
        "Session token was not issued for this application",
        "azp_mismatch",
      );
    }

    return {
      clerkUserId: claims.sub,
      sessionId: claims.sid ?? null,
      expiresAt: new Date(claims.exp * 1000),
    };
  };
}

/**
 * The process-wide verifier, pointed at Clerk's JWKS.
 *
 * `createRemoteJWKSet` handles the two things a hand-rolled fetch gets wrong:
 * it caches the key set instead of making a network call per request, and when
 * it meets a `kid` it has not seen it refetches — which is what makes Clerk's
 * key rotation a non-event rather than a global outage. The cooldown stops an
 * attacker turning "sign a token with a made-up kid" into a way to hammer
 * Clerk's servers through us.
 *
 * Lazily constructed so that importing this module — which tests do, to reach
 * `createTokenVerifier` — does not open a socket.
 */
let defaultVerifier: TokenVerifier | undefined;

export function getTokenVerifier(): TokenVerifier {
  defaultVerifier ??= createTokenVerifier({
    jwks: createRemoteJWKSet(new URL(config.clerk.jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    }),
    issuer: config.clerk.issuer,
    authorizedParties: config.clerk.authorizedParties,
  });

  return defaultVerifier;
}
