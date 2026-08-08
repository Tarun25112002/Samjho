import { Router } from "express";

import { getHealth, getReadiness } from "./health.service.js";

/**
 * Route layer: parse the request, call the service, shape the response.
 *
 * Note how little is here. If a route grows an `if`, that logic belongs in the
 * service — keeping routes thin is what keeps business rules testable without
 * spinning up HTTP.
 */
export const healthRouter: Router = Router();

/** Liveness. Never touches the database — see the contract for why. */
healthRouter.get("/health", (_req, res) => {
  res.json({ data: getHealth() });
});

/** Readiness. Probes dependencies; 503 when any are down. */
healthRouter.get("/ready", async (_req, res) => {
  const readiness = await getReadiness();
  res.status(readiness.status === "ready" ? 200 : 503).json({ data: readiness });
});
