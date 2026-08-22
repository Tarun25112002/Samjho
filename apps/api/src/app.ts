import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
// Named import, not default: pino-http is CommonJS but ships ESM-style types,
// so its `export default` does not correspond to a real runtime export. The
// named binding is correct on both sides.
import { pinoHttp } from "pino-http";

import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { getTokenVerifier, type TokenVerifier } from "./lib/token-verifier.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { buildMeRouter } from "./modules/auth/auth.routes.js";
import { buildCatalogAdminRouter } from "./modules/catalog/catalog.admin.routes.js";
import { buildCatalogRouter } from "./modules/catalog/catalog.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { buildBookmarkRouter } from "./modules/practice/bookmark.routes.js";
import { buildPracticeRouter } from "./modules/practice/practice.routes.js";
import { buildQuestionRouter } from "./modules/questions/question.routes.js";
import { buildQuestionAdminRouter } from "./modules/questions/question.admin.routes.js";
import { buildAdminDashboardRouter } from "./modules/questions/dashboard.routes.js";
import { buildClerkWebhookRouter } from "./modules/webhooks/clerk.routes.js";

export const API_PREFIX = "/api/v1";

export interface CreateAppOptions {
  /**
   * Override token verification.
   *
   * Exists so tests can supply a verifier backed by a locally generated key
   * pair and mint their own tokens — the whole auth chain then runs for real
   * instead of against a mock. Production leaves this unset and gets the
   * JWKS-backed verifier.
   */
  verifyToken?: TokenVerifier;
}

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
 *   4. webhooks        — BEFORE the JSON parser; they need the raw body
 *   5. body parsers    — with a size cap
 *   6. routes
 *   7. notFound        — nothing matched
 *   8. errorHandler    — must be last; Express identifies it by arity (4 args)
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const verifyToken = options.verifyToken ?? getTokenVerifier();
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

  // Webhooks must come before the JSON parser. Svix signs the *bytes* Clerk
  // sent; once express.json() has consumed the stream, those bytes are gone and
  // no amount of re-serialising reproduces them faithfully. Unversioned because
  // the sender is Clerk's configuration, not our client.
  app.use("/webhooks", buildClerkWebhookRouter());

  // 1MB default. Large payloads get an explicit, separately-limited route
  // (admin bulk import, Phase 4) rather than raising this ceiling globally.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Unversioned: orchestrators probe fixed paths, and these are not part of the
  // product API's contract.
  app.use(healthRouter);

  app.use(API_PREFIX, buildApiRouter(verifyToken));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Versioned product API. Feature modules mount here as they land:
 *   router.use("/exam-attempts", examRouter)
 */
function buildApiRouter(verifyToken: TokenVerifier): express.Router {
  const router = express.Router();

  // Unauthenticated: the version banner is not sensitive, and something has to
  // answer at the API root.
  router.get("/", (_req, res) => {
    res.json({ data: { service: config.service, version: config.version, api: "v1" } });
  });

  router.use("/me", buildMeRouter(verifyToken));
  router.use("/catalog", buildCatalogRouter(verifyToken));
  router.use("/questions", buildQuestionRouter(verifyToken));
  router.use("/practice-sessions", buildPracticeRouter(verifyToken));
  router.use("/bookmarks", buildBookmarkRouter(verifyToken));

  // Mounted under its own prefix rather than as extra verbs on /catalog, so the
  // day the public SEO pages need an unauthenticated catalog (Phase 9) nobody
  // can open up the writes by loosening one `router.use`.
  router.use("/admin/catalog", buildCatalogAdminRouter(verifyToken));
  router.use("/admin/questions", buildQuestionAdminRouter(verifyToken));
  router.use("/admin/dashboard", buildAdminDashboardRouter(verifyToken));

  return router;
}
