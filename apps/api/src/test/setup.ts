/**
 * Test environment defaults.
 *
 * Set before any module loads, because lib/config.ts validates and exits on
 * import — a missing DATABASE_URL would kill the test runner rather than fail a
 * test. This URL is never connected to in unit tests; the readiness test stubs
 * Prisma out.
 */
process.env["NODE_ENV"] = "test";
process.env["LOG_LEVEL"] = "silent";
process.env["DATABASE_URL"] ??= "postgresql://samjho:samjho@localhost:5432/samjho_test";

/**
 * Clerk placeholders.
 *
 * These exist only so `lib/config.ts` validates — no test ever reaches Clerk.
 * Token verification is exercised against a locally generated RSA key pair
 * (`src/test/auth-fixtures.ts`) and injected into `createApp`, so the real
 * verification code runs without a network call. The issuer below is what those
 * fixtures sign against, so it has to match theirs.
 */
process.env["CLERK_ISSUER_URL"] ??= "https://test.clerk.samjho.invalid";
process.env["CLERK_SECRET_KEY"] ??= "sk_test_not_a_real_key";
process.env["CLERK_WEBHOOK_SIGNING_SECRET"] ??= "whsec_c2FtamhvLXRlc3Qtc2lnbmluZy1rZXkh";
