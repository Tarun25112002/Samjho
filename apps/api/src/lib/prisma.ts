import { PrismaClient } from "../generated/prisma/client.js";

import { config } from "./config.js";
import { logger } from "./logger.js";

/**
 * The single PrismaClient for the process.
 *
 * One instance, not one per request: each client owns a connection pool, so
 * constructing them per request exhausts Postgres' connection limit almost
 * immediately. This is the most common Prisma production incident.
 *
 * Note that only this service talks to the database. `apps/web` has no Prisma
 * dependency at all — a constraint that also means the serverless web tier can
 * scale without any risk of pool exhaustion.
 */
export const prisma = new PrismaClient({
  datasourceUrl: config.databaseUrl,
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
