import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

/**
 * The single PrismaClient for the process.
 *
 * **One instance, not one per request.** Each client owns a connection pool, so
 * constructing them per request exhausts Postgres' connection limit almost
 * immediately. This is the most common Prisma production incident.
 *
 * **Driver adapters.** Prisma 7 connects through a standard Node driver (`pg`)
 * instead of a bundled Rust query engine. That means the pool is a normal
 * `pg.Pool` we can size and observe with ordinary tools, and there is no native
 * binary to match to the deployment platform.
 *
 * Note that only this service talks to the database — `apps/web` has no Prisma
 * dependency at all. That is a side benefit of the two-app architecture: a
 * serverless web tier can scale freely with no risk of pool exhaustion, because
 * it holds no connections.
 */
const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
  // Sized for a single long-running API instance. Postgres' default ceiling is
  // 100 connections total, shared across every instance, migrations and psql
  // session — so this stays well clear of it.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const prisma = new PrismaClient({
  adapter,
  log: config.isProduction
    ? [{ emit: "event", level: "error" }]
    : [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
});

prisma.$on("error", (event) => {
  logger.error({ target: event.target }, event.message);
});

if (!config.isProduction) {
  prisma.$on("warn", (event) => {
    logger.warn({ target: event.target }, event.message);
  });
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
