import { describe, expect, it } from "vitest";

import {
  createTestVerifier,
  mintToken,
  TEST_AUTHORIZED_PARTY,
  TEST_ISSUER,
  testJwks,
} from "../test/auth-fixtures.js";
import { createTokenVerifier, TokenVerificationError } from "./token-verifier.js";

/**
 * The security boundary of the product, tested directly.
 *
 * Each case below is a specific forgery or mistake. If any of them starts
 * passing, an attacker gains something concrete — so these assertions are worth
 * more than their line count suggests.
 */

const verify = createTestVerifier();

async function reasonFor(token: string): Promise<string> {
  try {
    await verify(token);
  } catch (error) {
    if (error instanceof TokenVerificationError) return error.reason;
    throw error;
  }
  throw new Error("expected verification to fail, but it succeeded");
}

describe("createTokenVerifier", () => {
  it("accepts a well-formed token and returns the claims we care about", async () => {
    const token = await mintToken({ subject: "user_abc", sessionId: "sess_xyz" });

    const result = await verify(token);

    expect(result.clerkUserId).toBe("user_abc");
    expect(result.sessionId).toBe("sess_xyz");
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns a null sessionId rather than undefined when sid is absent", async () => {
    // Callers store this straight into a nullable column; `undefined` would
    // become a Prisma "leave unchanged" instead of an explicit null.
    const result = await verify(await mintToken({ sessionId: null }));
    expect(result.sessionId).toBeNull();
  });

  it("rejects a token signed by a key the JWKS does not publish", async () => {
    // The forgery this whole mechanism exists to stop: correct claims, correct
    // shape, wrong signer.
    expect(await reasonFor(await mintToken({ signWithForeignKey: true }))).toBe(
      "signature_or_claims",
    );
  });

  it("rejects a token whose kid is not in the key set", async () => {
    expect(await reasonFor(await mintToken({ kid: "some-other-key" }))).toBe("signature_or_claims");
  });

  it("rejects an expired token", async () => {
    // Well past the 5-second clock tolerance.
    expect(await reasonFor(await mintToken({ expiresInSeconds: -60 }))).toBe("signature_or_claims");
  });

  it("rejects a token that is not valid yet", async () => {
    expect(await reasonFor(await mintToken({ notBeforeOffsetSeconds: 600 }))).toBe(
      "signature_or_claims",
    );
  });

  it("rejects a token from a different issuer", async () => {
    // A Clerk token from someone else's instance is perfectly valid — just not
    // to us. Without the issuer check, anyone with a free Clerk account could
    // mint tokens this API would honour.
    expect(await reasonFor(await mintToken({ issuer: "https://evil.clerk.accounts.dev" }))).toBe(
      "signature_or_claims",
    );
  });

  it("rejects a token minted for a different origin", async () => {
    expect(await reasonFor(await mintToken({ azp: "https://not-samjho.example" }))).toBe(
      "azp_mismatch",
    );
  });

  it("rejects a token with no azp claim at all", async () => {
    // The stricter reading, deliberately: a missing claim must not be easier to
    // satisfy than a wrong one.
    expect(await reasonFor(await mintToken({ azp: null }))).toBe("azp_mismatch");
  });

  it("rejects garbage that is not a JWT", async () => {
    expect(await reasonFor("not-a-token")).toBe("signature_or_claims");
  });

  it("tolerates small clock skew rather than failing on it", async () => {
    // Two seconds in the past, inside the 5-second tolerance. Machines drift;
    // a student should not be logged out because NTP wobbled.
    await expect(verify(await mintToken({ expiresInSeconds: -2 }))).resolves.toMatchObject({
      clerkUserId: "user_test_default",
    });
  });

  it("refuses to be constructed with no authorized parties", () => {
    // Configuration that silently accepts every origin is worse than a crash at
    // boot, because nothing about it looks wrong in production.
    expect(() =>
      createTokenVerifier({ jwks: testJwks, issuer: TEST_ISSUER, authorizedParties: [] }),
    ).toThrow(/at least one authorized party/);
  });

  it("accepts any of several configured authorized parties", async () => {
    const multi = createTokenVerifier({
      jwks: testJwks,
      issuer: TEST_ISSUER,
      authorizedParties: ["https://samjho.app", TEST_AUTHORIZED_PARTY],
    });

    await expect(multi(await mintToken())).resolves.toMatchObject({
      clerkUserId: "user_test_default",
    });
  });
});
