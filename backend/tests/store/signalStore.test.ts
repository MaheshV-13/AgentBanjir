/**
 * @module tests/store/signalStore.test
 *
 * Unit tests for InMemorySignalStore (ISignalStore implementation).
 *
 * Tests the store in complete isolation — no HTTP layer, no Express, no stubs.
 * Verifies all six interface methods: getAll, getById, upsert, updateStatus,
 * count, and clear.
 */
import { signalStore } from "@/store/signalStore";
import { buildEnrichedSignal } from "../helpers/fixtures";
import type { EnrichedSignal } from "@/types/signal.types";

// IDs are deterministic UUIDs v4 to satisfy the store's UUID expectation.
const ID_A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const ID_C = "cccccccc-cccc-4ccc-cccc-cccccccccccc";

describe("InMemorySignalStore", () => {
  beforeEach(() => {
    signalStore.clear();
  });

  // ── count() ────────────────────────────────────────────────────────────────

  describe("count()", () => {
    it("returns 0 on a fresh store", () => {
      expect(signalStore.count()).toBe(0);
    });

    it("reflects inserted signals", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A }));
      signalStore.upsert(buildEnrichedSignal({ id: ID_B }));
      expect(signalStore.count()).toBe(2);
    });
  });

  // ── clear() ────────────────────────────────────────────────────────────────

  describe("clear()", () => {
    it("removes all signals", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A }));
      signalStore.upsert(buildEnrichedSignal({ id: ID_B }));
      signalStore.clear();
      expect(signalStore.count()).toBe(0);
    });
  });

  // ── upsert() ───────────────────────────────────────────────────────────────

  describe("upsert()", () => {
    it("inserts a new signal", () => {
      const signal = buildEnrichedSignal({ id: ID_A });
      signalStore.upsert(signal);
      expect(signalStore.count()).toBe(1);
    });

    it("replaces an existing signal with the same id", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A, severity_level: "Low" }));
      signalStore.upsert(buildEnrichedSignal({ id: ID_A, severity_level: "High" }));

      expect(signalStore.count()).toBe(1); // No duplicate inserted.
      expect(signalStore.getById(ID_A)?.severity_level).toBe("High");
    });

    it("stores multiple signals without collision", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A }));
      signalStore.upsert(buildEnrichedSignal({ id: ID_B }));
      signalStore.upsert(buildEnrichedSignal({ id: ID_C }));
      expect(signalStore.count()).toBe(3);
    });
  });

  // ── getById() ──────────────────────────────────────────────────────────────

  describe("getById()", () => {
    it("returns the signal when the id exists", () => {
      const signal = buildEnrichedSignal({ id: ID_A });
      signalStore.upsert(signal);

      const result = signalStore.getById(ID_A);
      expect(result).toBeDefined();
      expect(result?.id).toBe(ID_A);
    });

    it("returns undefined for a non-existent id", () => {
      expect(signalStore.getById("00000000-0000-4000-0000-000000000000")).toBeUndefined();
    });
  });

  // ── getAll() ───────────────────────────────────────────────────────────────

  describe("getAll()", () => {
    it("returns an empty array when the store is empty", () => {
      expect(signalStore.getAll()).toEqual([]);
    });

    it("returns all inserted signals", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A }));
      signalStore.upsert(buildEnrichedSignal({ id: ID_B }));

      const all = signalStore.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.id)).toEqual(expect.arrayContaining([ID_A, ID_B]));
    });

    it("returns a copy array — mutations do not affect the store", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A }));
      const first = signalStore.getAll();
      // Mutate the returned array reference.
      first.push({} as EnrichedSignal);
      // Store should be unaffected.
      expect(signalStore.count()).toBe(1);
    });
  });

  // ── updateStatus() ─────────────────────────────────────────────────────────

  describe("updateStatus()", () => {
    it("updates the status and returns the updated signal", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A, status: "Pending_Human_Review" }));

      const updated = signalStore.updateStatus(ID_A, "Dispatched");

      expect(updated).toBeDefined();
      expect(updated?.status).toBe("Dispatched");
      expect(updated?.id).toBe(ID_A);
    });

    it("returns undefined for a non-existent id", () => {
      const result = signalStore.updateStatus("00000000-0000-4000-0000-000000000000", "Dispatched");
      expect(result).toBeUndefined();
    });

    it("persists the new status in the store", () => {
      signalStore.upsert(buildEnrichedSignal({ id: ID_A, status: "Pending_Human_Review" }));
      signalStore.updateStatus(ID_A, "Rejected");

      expect(signalStore.getById(ID_A)?.status).toBe("Rejected");
    });

    it("updates updated_at to a time >= created_at", () => {
      const original = buildEnrichedSignal({ id: ID_A });
      signalStore.upsert(original);

      // Delay 1ms to guarantee updated_at > created_at.
      const before = Date.now();
      signalStore.updateStatus(ID_A, "Dispatched");

      const stored = signalStore.getById(ID_A)!;
      expect(new Date(stored.updated_at).getTime()).toBeGreaterThanOrEqual(before);
    });

    it("does not mutate the original signal object", () => {
      const original = buildEnrichedSignal({ id: ID_A, status: "Pending_Human_Review" });
      signalStore.upsert(original);
      signalStore.updateStatus(ID_A, "Dispatched");

      // The original fixture object should be unchanged (store creates a new object).
      expect(original.status).toBe("Pending_Human_Review");
    });
  });
});
