import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Each test file gets a clean module registry so config/singletons
    // can't leak between files.
    isolate: true,
    setupFiles: ["./src/test/setup.ts"],

    /**
     * Thirty seconds, not Vitest's five.
     *
     * Almost every file here talks to a real Postgres, and each one builds its
     * own fixture — a subject, a chapter, topics and a few dozen questions —
     * before its first assertion. In isolation that is comfortably under a
     * second; with the whole suite running in parallel against one database on a
     * laptop it is occasionally not, and the failure looks exactly like a
     * genuine hang.
     *
     * Raising it does not hide a slow test, because nothing here is *waiting*
     * for anything: a test that genuinely deadlocks still fails, thirty seconds
     * later. What it removes is a flake whose only cause is how many other
     * files happened to be doing setup at the same moment.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,

    /**
     * Bounded concurrency, because the connection pool is the real constraint.
     *
     * Every file constructs its own PrismaClient, and each of those opens a pool
     * of up to ten connections (`lib/prisma.ts`). Postgres' default ceiling is
     * 100 for the whole server, shared with migrations and any open psql
     * session — so an unbounded worker count walks into "Connection terminated
     * due to connection timeout" as the suite grows, which is a failure about
     * the runner rather than about the code.
     *
     * Six workers keeps the worst case at sixty connections with room to spare,
     * and costs a few seconds of wall time against a class of failure that
     * wastes far more than that in re-runs.
     */
    maxWorkers: 6,
  },
});
