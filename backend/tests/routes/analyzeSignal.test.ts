/**
 * @module tests/routes/analyzeSignal.test
 *
 * Integration tests for POST /api/v1/analyze-signal.
 *
 * Strategy: Test the gateway layer in isolation. The stub implementations of
 * Member 1 (processSignalStub) and Member 2 (floodCrisisOrchestrationFlowStub)
 * are already embedded in the route — no mocking of external modules is needed
 * until real implementations are swapped in.
 *
 * Coverage targets:
 *  - HTTP 200 + correct EnrichedSignal response shape
 *  - Zod validation gate (all INVALID_INPUT_CASES produce 400)
 *  - Signal is persisted to the store after a successful request
 *  - Error envelope shape on validation failures
 */
import request from "supertest";
import { createApp } from "@/app";
import { signalStore } from "@/store/signalStore";
import { EnrichedSignalSchema } from "@/schemas/enrichedSignalSchema";
import {
  buildValidInput,
  INVALID_INPUT_CASES,
} from "../helpers/fixtures";

// ─── MOCK THE AI ORCHESTRATOR ───────────────────────────────────────────────
// Industry Best Practice: Never hit real LLMs during automated CI/CD testing.
jest.mock("@/ai/signalOrchestrator", () => {
  return {
    SignalOrchestrator: class {
      async processSignal() {
        return {
          severity_level: "High",
          ai_confidence_score: 92,
          specific_needs: ["life_jacket", "medical_assistance"],
          nearest_boats: [],
        };
      }
    }
  };
});
// ────────────────────────────────────────────────────────────────────────────

const app = createApp();

describe("POST /api/v1/analyze-signal", () => {
  // Reset the shared in-memory store between tests to prevent order-dependency.
  beforeEach(() => {
    signalStore.clear();
  });

  // ── Happy Path ──────────────────────────────────────────────────────────────

  describe("when given a valid input", () => {
    it("returns HTTP 200", async () => {
      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send(buildValidInput());

      expect(res.status).toBe(200);
    });

    it("returns a response that conforms to EnrichedSignalSchema", async () => {
      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send(buildValidInput());

      // Parse against the full Zod schema — any shape deviation throws here.
      const parsed = EnrichedSignalSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
    });

    it("passes GPS coordinates through to the response unmodified", async () => {
      const coords = { lat: 1.5535, lng: 103.7768 };
      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send(buildValidInput({ gps_coordinates: coords }));

      expect(res.body.gps_coordinates).toEqual(coords);
    });

    it("assigns a valid UUID v4 as the signal id", async () => {
      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send(buildValidInput());

      expect(res.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("assigns 'Dispatched' status because the stub forces High severity", async () => {
      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send(buildValidInput());

      expect(res.body.status).toBe("Dispatched");
    });

    it("persists the enriched signal to the store", async () => {
      expect(signalStore.count()).toBe(0);

      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send(buildValidInput());

      expect(signalStore.count()).toBe(1);
      const stored = signalStore.getById(res.body.id as string);
      expect(stored).toBeDefined();
      expect(stored?.id).toBe(res.body.id);
    });

    it("assigns a unique id on each call", async () => {
      const [res1, res2] = await Promise.all([
        request(app).post("/api/v1/analyze-signal").send(buildValidInput()),
        request(app).post("/api/v1/analyze-signal").send(buildValidInput()),
      ]);

      expect(res1.body.id).not.toBe(res2.body.id);
      expect(signalStore.count()).toBe(2);
    });

    it("returns the X-Request-ID header", async () => {
      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send(buildValidInput());

      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });

  // ── Validation Gate ─────────────────────────────────────────────────────────

  describe("when given invalid input", () => {
    it.each(INVALID_INPUT_CASES)(
      "returns 400 for: $label",
      async ({ body }) => {
        const res = await request(app)
          .post("/api/v1/analyze-signal")
          .send(body);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(res.body.error.request_id).toBeDefined();
        expect(res.body.error.timestamp).toBeDefined();
        // Field-level error details must be present for actionable client feedback.
        expect(res.body.error.details).toBeDefined();
      }
    );

    it("does not persist a signal to the store on validation failure", async () => {
      await request(app)
        .post("/api/v1/analyze-signal")
        .send({ raw_message: "invalid — missing required fields" });

      expect(signalStore.count()).toBe(0);
    });

    it("returns 400 for a completely empty body", async () => {
      const res = await request(app)
        .post("/api/v1/analyze-signal")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
