import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { disconnectPrisma } from "./lib/prisma.js";

/**
 * Process entry point: bind a port, then shut down cleanly.
 *
 * Graceful shutdown is not ceremony. On deploy the platform sends SIGTERM and
 * then SIGKILLs after a grace period. Without the handler below, in-flight
 * requests are severed mid-response and database connections are left for
 * Postgres to time out. With it, the server stops accepting new connections,
 * lets running requests finish, and releases the pool.
 *
 * This matters more here than in most apps: a student could be three minutes
 * from the end of a board exam simulation when a deploy lands.
 */
const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env },
    `${config.service} listening on http://localhost:${config.port}`,
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutting down");

  // Force-exit if a hung connection stops the close callback from firing.
  const forceTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out after 10s, forcing exit");
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  server.close(async (error) => {
    if (error) logger.error({ err: error }, "Error while closing HTTP server");
    try {
      await disconnectPrisma();
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, "Error disconnecting Prisma");
    }
    logger.info("Shutdown complete");
    process.exit(error ? 1 : 0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// An unhandled rejection means state is now unknown. Log it and let the
// platform restart a clean process rather than serve from a corrupt one.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  void shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void shutdown("uncaughtException");
});
