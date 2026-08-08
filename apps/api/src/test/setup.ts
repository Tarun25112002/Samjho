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
