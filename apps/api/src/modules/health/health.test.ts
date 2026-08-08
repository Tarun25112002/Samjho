import {
  ERROR_CODES,
  healthResponseSchema,
  readinessResponseSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";

// Stub the database so these stay unit tests. The real connection is exercised
// by `pnpm db:up` + a manual /ready call, and by integration tests from Phase 1.
const queryRaw = vi.hoisted(() => vi.fn());
vi.mock("../../lib/prisma.js", () => ({
  prisma: { $queryRaw: queryRaw, $on: vi.fn() },
  disconnectPrisma: vi.fn(),
}));

const app = createApp();

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /health", () => {
  it("reports liveness in the shape the contract promises", async () => {
    const response = await request(app).get("/health").expect(200);

    // Parsing with the shared schema is the point of this assertion. If someone
    // changes the response and forgets the contract — or changes the contract
    // and forgets the response — this fails. Hand-written `expect` calls on
    // individual fields would not catch a field being dropped.
    const parsed = successResponseSchema(healthResponseSchema).parse(response.body);

    expect(parsed.data.status).toBe("ok");
    expect(parsed.data.service).toBe("samjho-api");
  });

  it("does not touch the database", async () => {
    await request(app).get("/health").expect(200);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("returns a request id header for log correlation", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("propagates an inbound request id so traces span web -> api", async () => {
    const response = await request(app)
      .get("/health")
      .set("x-request-id", "trace-me-123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("trace-me-123");
  });
});

describe("GET /ready", () => {
  it("returns 200 and status ready when the database answers", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await request(app).get("/ready").expect(200);
    const parsed = successResponseSchema(readinessResponseSchema).parse(response.body);

    expect(parsed.data.status).toBe("ready");
    expect(parsed.data.checks[0]).toMatchObject({ name: "postgres", status: "up", error: null });
  });

  it("returns 503 and status degraded when the database is unreachable", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const response = await request(app).get("/ready").expect(503);
    const parsed = successResponseSchema(readinessResponseSchema).parse(response.body);

    expect(parsed.data.status).toBe("degraded");
    expect(parsed.data.checks[0]).toMatchObject({ status: "down", error: "connection refused" });
  });
});

describe("error handling", () => {
  it("returns the error envelope with a request id for unmatched routes", async () => {
    const response = await request(app).get("/no-such-route").expect(404);

    expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    expect(response.body.error.requestId).toBeTruthy();
    expect(response.body.error.message).toContain("/no-such-route");
  });

  it("does not advertise the server implementation", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
