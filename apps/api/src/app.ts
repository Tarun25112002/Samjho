import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { healthRouter } from "./modules/health/health.routes.js";

export const API_PREFIX = "/api/v1";

/**
 * Builds the Express app without starting a server.
 *
 * The separation from server.ts matters: tests can pass this straight to
 * supertest and exercise real routes, real middleware and real error handling
 * without binding a port. No port means no "address already in use" between
 * test files, and tests can run in parallel.
 *
 * Middleware order is not arbitrary — each layer depends on the one above:
 *   1. requestContext  — establishes the request id everything else logs with
 *   2. pinoHttp        — request logging (needs the id)
 *   3. helmet / cors   — reject hostile requests before parsing their body
 *   4. body parsers    — with a size cap
 *   5. routes
 *   6. notFound        — nothing matched
 *   7. errorHandler    — must be last; Express identifies it by arity (4 args)
 */
export function createApp(): Express {
  const app = express();

  // Trust the platform's proxy so req.ip is the client, not the load balancer.
  // Required for correct IP-based rate limiting in Phase 2+.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(requestContext);

  app.use(
    pinoHttp({
      logger,
      // Health checks fire every few seconds; logging them at info level buries
      // everything else.
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/ready",
      },
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );

  app.use(helmet());

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      // Echoed back so the web app can read the id from a failed response.
      exposedHeaders: ["x-request-id"],
    }),
  );

  // 1MB default. Large payloads get an explicit, separately-limited route
  // (admin bulk import, Phase 4) rather than raising this ceiling globally.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Unversioned: orchestrators probe fixed paths, and these are not part of the
  // product API's contract.
  app.use(healthRouter);

  app.use(API_PREFIX, buildApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Versioned product API. Feature modules mount here as they land:
 *   router.use("/catalog", catalogRouter)
 *   router.use("/practice-sessions", practiceRouter)
 */
function buildApiRouter(): express.Router {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({ data: { service: config.service, version: config.version, api: "v1" } });
  });

  return router;
}
