/**
 * @module tests/routes/health.test
 *
 * Integration tests for GET /health.
 *
 * Verifies: response shape, HTTP status, no authentication required,
 * and that the endpoint survives concurrent probe requests without error.
 */
import request from "supertest";
import { createApp } from "@/app";
import type { HealthCheckResponse } from "@/types/signal.types";

// A fresh app instance is shared within this describe block.
// No store state is involved, so no beforeEach reset is needed.
const app = createApp();

describe("GET /health", () => {
  it("returns HTTP 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("returns the correct response shape", async () => {
    const res = await request(app).get("/health");
    const body = res.body as HealthCheckResponse;

    expect(body).toMatchObject<Partial<HealthCheckResponse>>({
      status: "ok",
    });
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns a valid ISO 8601 timestamp", async () => {
    const res  = await request(app).get("/health");
    const body = res.body as HealthCheckResponse;
    const parsed = new Date(body.timestamp);
    expect(parsed.toString()).not.toBe("Invalid Date");
  });

  it("sets the X-Request-ID response header", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-request-id"]).toMatch(
      // UUID v4 regex
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("returns a different X-Request-ID on each call", async () => {
    const [res1, res2] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/health"),
    ]);
    expect(res1.headers["x-request-id"]).not.toBe(res2.headers["x-request-id"]);
  });

  it("returns 404 with error envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(typeof res.body.error.request_id).toBe("string");
  });
});
