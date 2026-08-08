import type { DependencyCheck, HealthResponse, ReadinessResponse } from "@samjho/contracts";

import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Health module service layer.
 *
 * Trivial today, but it establishes the pattern the whole API follows: the
 * service returns plain data and knows nothing about Express. No `req`, no
 * `res`, no status codes. That is what makes it callable from a test, a script,
 * or a background job without pretending to be an HTTP request.
 */

const startedAt = Date.now();

export function getHealth(): HealthResponse {
  return {
    status: "ok",
    service: config.service,
    version: config.version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}

/** Times a dependency probe and converts a throw into a `down` result. */
async function checkDependency(
  name: string,
  probe: () => Promise<unknown>,
): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    await probe();
    return { name, status: "up", latencyMs: Math.round(performance.now() - start), error: null };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);

    // Log the real failure — an operator needs the detail.
    logger.error({ err: error, dependency: name }, `Readiness check failed: ${name}`);

    return {
      name,
      status: "down",
      latencyMs,
      // But do not return it. /ready is typically reachable without auth, and a
      // raw driver error happily volunteers connection strings, host names and
      // query text. In development the detail is worth more than the exposure.
      error: config.isProduction
        ? "unavailable"
        : error instanceof Error
          ? error.message.replace(/\s+/g, " ").trim().slice(0, 200)
          : "Unknown error",
    };
  }
}

export async function getReadiness(): Promise<ReadinessResponse> {
  const checks = await Promise.all([
    // SELECT 1 verifies the pool can hand out a working connection. It does not
    // verify schema state — `migrate deploy` runs as a release step, so a
    // migration check here would be measuring the wrong thing.
    checkDependency("postgres", () => prisma.$queryRaw`SELECT 1`),
  ]);

  return {
    status: checks.every((check) => check.status === "up") ? "ready" : "degraded",
    service: config.service,
    version: config.version,
    checks,
    timestamp: new Date().toISOString(),
  };
}
