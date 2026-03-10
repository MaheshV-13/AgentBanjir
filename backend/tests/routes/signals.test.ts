/**
 * @module tests/routes/signals.test
 *
 * Integration tests for:
 *  - GET  /api/v1/signals
 *  - PATCH /api/v1/signals/:id/status
 *
 * Strategy: Pre-seed the store directly via signalStore.upsert() to test the
 * GET and PATCH routes without making real POST /analyze-signal calls.
 * This isolates route behaviour from the orchestration logic.
 */
import request from "supertest";
import { createApp } from "@/app";
import { signalStore } from "@/store/signalStore";
import { buildEnrichedSignal } from "../helpers/fixtures";
import type { SignalsListResponse, EnrichedSignal } from "@/types/signal.types";

const app = createApp();

describe("GET /api/v1/signals", () => {
  beforeEach(() => {
    signalStore.clear();
  });

  // ── Empty Store ─────────────────────────────────────────────────────────────

  it("returns 200 with an empty array when no signals exist", async () => {
    const res  = await request(app).get("/api/v1/signals");
    const body = res.body as SignalsListResponse;

    expect(res.status).toBe(200);
    expect(body.signals).toEqual([]);
    expect(body.total).toBe(0);
    expect(typeof body.synced_at).toBe("string");
  });

  // ── Seeded Store ────────────────────────────────────────────────────────────

  it("returns all signals when the store contains entries", async () => {
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000001", severity_level: "Low"    }));
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000002", severity_level: "High"   }));
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000003", severity_level: "Medium" }));

    const res  = await request(app).get("/api/v1/signals");
    const body = res.body as SignalsListResponse;

    expect(res.status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.signals).toHaveLength(3);
  });

  it("sorts signals High → Medium → Low", async () => {
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000001", severity_level: "Low"    }));
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000002", severity_level: "High"   }));
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000003", severity_level: "Medium" }));

    const res     = await request(app).get("/api/v1/signals");
    const signals = (res.body as SignalsListResponse).signals;

    expect(signals[0]!.severity_level).toBe("High");
    expect(signals[1]!.severity_level).toBe("Medium");
    expect(signals[2]!.severity_level).toBe("Low");
  });

  // ── Severity Filter ─────────────────────────────────────────────────────────

  it("filters by ?severity=High correctly", async () => {
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000001", severity_level: "Low"  }));
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000002", severity_level: "High" }));

    const res  = await request(app).get("/api/v1/signals?severity=High");
    const body = res.body as SignalsListResponse;

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.signals[0]!.severity_level).toBe("High");
  });

  it("returns an empty array when the severity filter matches nothing", async () => {
    signalStore.upsert(buildEnrichedSignal({ id: "00000000-0000-4000-a000-000000000001", severity_level: "Low" }));

    const res  = await request(app).get("/api/v1/signals?severity=High");
    const body = res.body as SignalsListResponse;

    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.signals).toEqual([]);
  });

  it("returns 400 for an invalid ?severity= value", async () => {
    const res = await request(app).get("/api/v1/signals?severity=Critical");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY_PARAM");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/v1/signals/:id/status", () => {
  const SIGNAL_ID = "00000000-0000-4000-a000-000000000001";

  beforeEach(() => {
    signalStore.clear();
    // Seed one signal for PATCH tests.
    signalStore.upsert(
      buildEnrichedSignal({ id: SIGNAL_ID, status: "Pending_Human_Review" })
    );
  });

  // ── Happy Path ──────────────────────────────────────────────────────────────

  it("returns 200 when transitioning to Dispatched", async () => {
    const res = await request(app)
      .patch(`/api/v1/signals/${SIGNAL_ID}/status`)
      .send({ status: "Dispatched" });

    expect(res.status).toBe(200);
    const body = res.body as EnrichedSignal;
    expect(body.status).toBe("Dispatched");
    expect(body.id).toBe(SIGNAL_ID);
  });

  it("returns 200 when transitioning to Rejected", async () => {
    const res = await request(app)
      .patch(`/api/v1/signals/${SIGNAL_ID}/status`)
      .send({ status: "Rejected" });

    expect(res.status).toBe(200);
    expect((res.body as EnrichedSignal).status).toBe("Rejected");
  });

  it("mutates the status in the store persistently", async () => {
    await request(app)
      .patch(`/api/v1/signals/${SIGNAL_ID}/status`)
      .send({ status: "Dispatched" });

    const stored = signalStore.getById(SIGNAL_ID);
    expect(stored?.status).toBe("Dispatched");
  });

  it("updates the updated_at timestamp on mutation", async () => {
    const before = signalStore.getById(SIGNAL_ID)!.updated_at;

    // Delay 1ms to guarantee timestamp difference.
    await new Promise((r) => setTimeout(r, 1));

    await request(app)
      .patch(`/api/v1/signals/${SIGNAL_ID}/status`)
      .send({ status: "Dispatched" });

    const after = signalStore.getById(SIGNAL_ID)!.updated_at;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  // ── Error Cases ─────────────────────────────────────────────────────────────

  it("returns 404 when the signal ID does not exist", async () => {
    const res = await request(app)
      .patch("/api/v1/signals/99999999-9999-4999-a999-999999999999/status")
      .send({ status: "Dispatched" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for an invalid status value", async () => {
    const res = await request(app)
      .patch(`/api/v1/signals/${SIGNAL_ID}/status`)
      .send({ status: "Resolved" }); // Not a valid SignalStatus

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATUS");
  });

  it("returns 400 when trying to re-apply Pending_Human_Review", async () => {
    // Operators cannot re-apply the initial status — only terminal values allowed.
    const res = await request(app)
      .patch(`/api/v1/signals/${SIGNAL_ID}/status`)
      .send({ status: "Pending_Human_Review" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATUS");
  });

  it("returns 400 when request body is empty", async () => {
    const res = await request(app)
      .patch(`/api/v1/signals/${SIGNAL_ID}/status`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("includes request_id and timestamp in error envelope", async () => {
    const res = await request(app)
      .patch("/api/v1/signals/nonexistent-id/status")
      .send({ status: "Dispatched" });

    expect(res.body.error.request_id).toBeDefined();
    expect(res.body.error.timestamp).toBeDefined();
  });
});
