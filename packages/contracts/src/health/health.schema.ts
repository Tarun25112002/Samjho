import { z } from "zod";

/**
 * Health and readiness contracts.
 *
 * Two endpoints, deliberately different:
 *
 *   /health — liveness. "Is this process running?" Must never touch the
 *             database: if the DB is down, restarting the API won't help, and a
 *             failing liveness probe would make the platform kill a healthy
 *             process in a crash loop.
 *
 *   /ready  — readiness. "Can this process serve traffic?" Checks dependencies.
 *             A failing readiness probe pulls the instance out of the load
 *             balancer without killing it, which is the correct response to a
 *             database blip.
 *
 * Getting these two confused is a genuinely common production incident.
 */

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const dependencyCheckSchema = z.object({
  name: z.string(),
  status: z.enum(["up", "down"]),
  latencyMs: z.number().nullable(),
  error: z.string().nullable(),
});

export type DependencyCheck = z.infer<typeof dependencyCheckSchema>;

export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "degraded"]),
  service: z.string(),
  version: z.string(),
  checks: z.array(dependencyCheckSchema),
  timestamp: z.iso.datetime(),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
