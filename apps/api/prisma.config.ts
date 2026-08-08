import { defineConfig, env } from "prisma/config";

/**
 * Configuration for the Prisma CLI — `migrate`, `db push`, `studio`.
 *
 * Two Prisma 7 changes worth knowing:
 *
 *  1. `.env` is no longer loaded automatically. Implicit dotenv loading made it
 *     ambiguous which values a command actually ran with, especially across
 *     environments. Loading it explicitly is more typing and less guessing.
 *
 *  2. The connection URL lives here rather than in schema.prisma. The schema is
 *     committed; connection strings are not. Separating them removes a whole
 *     category of accidental credential commits.
 *
 * This file configures the CLI only. The *runtime* connection is established in
 * src/lib/prisma.ts via a driver adapter.
 *
 * The try/catch is load-bearing, not defensive noise: `loadEnvFile` throws
 * ENOENT when the file is absent, and it is absent in CI and in production,
 * where the environment is injected by the platform. Optional chaining does not
 * help — it guards against the *method* being missing, not the *file*.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the ambient environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Behind a connection pooler, migrations must use a direct connection:
    // directUrl: env("DIRECT_URL"),
  },
});
