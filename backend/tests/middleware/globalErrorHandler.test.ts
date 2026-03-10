/**
 * @module tests/middleware/globalErrorHandler.test
 *
 * Unit tests for globalErrorHandler.
 *
 * Strategy: Mount a minimal Express app with a single route that throws
 * a controlled error. Verify that the error handler produces the correct
 * HTTP status, error code, and envelope shape for each error class.
 * No Supertest-level routing logic is under test here.
 */
import request  from "supertest";
import express  from "express";
import { ZodError, ZodIssueCode } from "zod";
import { AppError, globalErrorHandler } from "@/middleware/globalErrorHandler";
import { requestLogger } from "@/middleware/requestLogger";

/**
 * Builds a minimal Express app that throws the given error from a test route,
 * then catches it with the global error handler.
 *
 * @param throwFn - A function that throws or calls next(err) with the test error.
 */
function buildTestApp(throwFn: (next: express.NextFunction) => void) {
  const app = express();
  app.use(express.json());
  app.use(requestLogger); // Provides res.locals.requestId for the error envelope.

  app.get("/test", (_req, _res, next) => {
    throwFn(next);
  });

  // 4-argument signature required for Express to recognise as error handler.
  app.use(globalErrorHandler);
  return app;
}

// ─── AppError Classification ──────────────────────────────────────────────────

describe("globalErrorHandler — AppError", () => {
  it("returns the AppError's statusCode and code", async () => {
    const app = buildTestApp((next) =>
      next(new AppError("NOT_FOUND", "Signal not found.", 404))
    );

    const res = await request(app).get("/test");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBe("Signal not found.");
  });

  it("includes request_id and timestamp in the envelope", async () => {
    const app = buildTestApp((next) =>
      next(new AppError("UPSTREAM_AI_FAILURE", "AI unavailable.", 502))
    );

    const res = await request(app).get("/test");

    expect(res.body.error.request_id).toBeDefined();
    expect(typeof res.body.error.timestamp).toBe("string");
  });

  it("includes details when the AppError has a details payload", async () => {
    const details = { allowed: ["Dispatched", "Rejected"] };
    const app = buildTestApp((next) =>
      next(new AppError("INVALID_STATUS", "Bad status.", 400, details))
    );

    const res = await request(app).get("/test");

    expect(res.body.error.details).toEqual(details);
  });

  it("omits details from envelope when none are provided", async () => {
    const app = buildTestApp((next) =>
      next(new AppError("INTERNAL_ERROR", "Boom.", 500))
    );

    const res = await request(app).get("/test");

    expect(res.body.error.details).toBeUndefined();
  });
});

// ─── ZodError Classification ──────────────────────────────────────────────────

describe("globalErrorHandler — ZodError", () => {
  /** Constructs a minimal ZodError with one issue for test purposes. */
  function makeZodError(): ZodError {
    return new ZodError([
      {
        code:    ZodIssueCode.invalid_type,
        path:    ["gps_coordinates", "lat"],
        message: "Expected number, received string",
        expected: "number",
        received: "string",
      },
    ]);
  }

  it("returns HTTP 400 for a ZodError", async () => {
    const app = buildTestApp((next) => next(makeZodError()));
    const res = await request(app).get("/test");
    expect(res.status).toBe(400);
  });

  it("returns VALIDATION_ERROR code", async () => {
    const app = buildTestApp((next) => next(makeZodError()));
    const res = await request(app).get("/test");
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("includes Zod issue details in the envelope", async () => {
    const app = buildTestApp((next) => next(makeZodError()));
    const res = await request(app).get("/test");
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect((res.body.error.details as unknown[]).length).toBeGreaterThan(0);
  });
});

// ─── Unhandled Error Classification ──────────────────────────────────────────

describe("globalErrorHandler — unhandled Error", () => {
  it("returns HTTP 500 for a plain Error", async () => {
    const app = buildTestApp((next) => next(new Error("Unexpected failure")));
    const res = await request(app).get("/test");
    expect(res.status).toBe(500);
  });

  it("returns INTERNAL_ERROR code", async () => {
    const app = buildTestApp((next) => next(new Error("Unexpected failure")));
    const res = await request(app).get("/test");
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("does not expose the stack trace in the response body", async () => {
    const app = buildTestApp((next) => next(new Error("Stack should not appear")));
    const res = await request(app).get("/test");

    // Serialise the entire response body and assert no stack-trace artifacts.
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("at Object.");
    expect(bodyStr).not.toContain(".test.ts");
  });
});
