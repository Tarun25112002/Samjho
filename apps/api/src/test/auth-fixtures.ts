import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type JWK } from "jose";

import { createTokenVerifier, type TokenVerifier } from "../lib/token-verifier.js";

/**
 * Real tokens, real signatures, no network.
 *
 * The alternative — stubbing `verifyToken` to return `{ clerkUserId: "u_1" }` —
 * would test that a mock returns what it was told to. The thing worth testing is
 * the verifier itself: that it rejects an expired token, a foreign signature, a
 * wrong issuer, or a mismatched `azp`. So the tests generate an RSA key pair, publish
 * the public half as a local JWKS, and sign genuine RS256 JWTs with the private
 * half. `createTokenVerifier` cannot tell the difference between this and Clerk,
 * which is exactly the property that makes these tests worth having.
 *
 * The issuer must match the one `test/setup.ts` puts in the environment, since
 * config-driven code paths read that.
 */

export const TEST_ISSUER = "https://test.clerk.samjho.invalid";
export const TEST_AUTHORIZED_PARTY = "http://localhost:3000";
const TEST_KID = "samjho-test-key";

const ours = await generateKeyPair("RS256", { extractable: true });
/** A second key pair that the JWKS does *not* publish — for forgery tests. */
const foreign = await generateKeyPair("RS256", { extractable: true });

const publicJwk: JWK = {
  ...(await exportJWK(ours.publicKey)),
  kid: TEST_KID,
  alg: "RS256",
  use: "sig",
};

export const testJwks = createLocalJWKSet({ keys: [publicJwk] });

export function createTestVerifier(): TokenVerifier {
  return createTokenVerifier({
    jwks: testJwks,
    issuer: TEST_ISSUER,
    authorizedParties: [TEST_AUTHORIZED_PARTY],
  });
}

export interface MintOptions {
  /** Clerk user id — the `sub` claim. */
  subject?: string;
  /** `null` omits the claim entirely, which is a case worth testing. */
  azp?: string | null;
  issuer?: string;
  sessionId?: string | null;
  /** Seconds from now. Negative mints an already-expired token. */
  expiresInSeconds?: number;
  /** Seconds from now. Positive mints a not-yet-valid token. */
  notBeforeOffsetSeconds?: number;
  /** Sign with a key the JWKS does not publish. */
  signWithForeignKey?: boolean;
  /** Point the header at a `kid` that does not exist. */
  kid?: string;
}

export async function mintToken(options: MintOptions = {}): Promise<string> {
  const {
    subject = "user_test_default",
    azp = TEST_AUTHORIZED_PARTY,
    issuer = TEST_ISSUER,
    sessionId = "sess_test",
    expiresInSeconds = 3600,
    notBeforeOffsetSeconds = 0,
    signWithForeignKey = false,
    kid = TEST_KID,
  } = options;

  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, unknown> = {};
  if (azp !== null) claims["azp"] = azp;
  if (sessionId !== null) claims["sid"] = sessionId;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(issuer)
    .setSubject(subject)
    .setIssuedAt(now)
    .setNotBefore(now + notBeforeOffsetSeconds)
    .setExpirationTime(now + expiresInSeconds)
    .sign(signWithForeignKey ? foreign.privateKey : ours.privateKey);
}

/** `Authorization` header value for a freshly minted token. */
export async function bearer(options: MintOptions = {}): Promise<string> {
  return `Bearer ${await mintToken(options)}`;
}
