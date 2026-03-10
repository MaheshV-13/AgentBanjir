/**
 * @module store/signalStore.types
 *
 * Store-specific type declarations: the ISignalStore interface contract,
 * query/filter options, mutation result types, and health snapshot shape.
 *
 * Keeping the interface here (rather than co-located in signalStore.ts) means:
 *  - There is exactly one import path for any consumer that depends on the contract.
 *  - signalStore.ts becomes a pure implementation file with no interface declarations.
 *  - A future Firestore adapter imports ISignalStore from here without touching
 *    the Map-backed implementation file at all.
 */
import type { EnrichedSignal, SeverityLevel, SignalStatus } from "@/types/signal.types";

// ─── Query / Filter Options ───────────────────────────────────────────────────

/**
 * Filter options accepted by future ISignalStore.getAll() implementations.
 * The current Map-backed store handles filtering in route handlers directly;
 * this type documents the intended query surface for a Firestore adapter.
 */
export interface SignalQueryOptions {
  /** Filter signals by severity level. */
  severity?: SeverityLevel;
  /** Filter signals by current lifecycle status. */
  status?: SignalStatus;
  /**
   * Maximum number of results to return.
   * Defaults to 100 — Cloud Run memory constraint for in-memory store.
   */
  limit?: number;
}

// ─── Store Operation Results ──────────────────────────────────────────────────

/**
 * Discriminated union returned by store write operations.
 * Allows callers to distinguish inserts from updates — useful for audit
 * logging in production Firestore implementations without an extra read.
 */
export type StoreWriteResult =
  | { operation: "inserted"; id: string }
  | { operation: "updated";  id: string };

// ─── Store Health ─────────────────────────────────────────────────────────────

/** Snapshot of store metrics for use in extended health check diagnostics. */
export interface StoreHealthSnapshot {
  /** Total signals currently held in the store. */
  total_signals:     number;
  /** Count of signals grouped by severity. */
  by_severity:       Record<SeverityLevel, number>;
  /** Count of signals grouped by status. */
  by_status:         Record<SignalStatus, number>;
  /** ISO 8601 timestamp of when the snapshot was taken. */
  snapshot_taken_at: string;
}

// ─── Store Interface Contract ─────────────────────────────────────────────────

/**
 * Interface contract for the signal persistence layer.
 *
 * The in-memory Map implementation (signalStore.ts) satisfies this interface
 * for hackathon scope. A production Firestore adapter must also satisfy it —
 * route handlers depend on this interface, not on the concrete class, so the
 * swap is a single-line change in signalStore.ts.
 *
 * Signature decisions:
 *  - upsert() returns void: callers don't need the write result; adding
 *    StoreWriteResult as a return type is a future logging concern.
 *  - count() and clear() are on the interface: tests use both extensively,
 *    and a Firestore adapter can implement them via COUNT queries / batch delete.
 *  - getHealthSnapshot() enables the /health endpoint to report store metrics
 *    without exposing the internal Map to route handlers.
 */
export interface ISignalStore {
  /**
   * Returns all stored signals as an array.
   * Ordering is not guaranteed — sorting is the caller's responsibility.
   */
  getAll(): EnrichedSignal[];

  /**
   * Returns a single signal by its UUID, or undefined if not found.
   * @param id - UUID assigned by the gateway on creation.
   */
  getById(id: string): EnrichedSignal | undefined;

  /**
   * Inserts a new signal or replaces an existing one with the same id.
   * @param signal - Fully enriched signal to persist.
   */
  upsert(signal: EnrichedSignal): void;

  /**
   * Mutates the status of an existing signal and updates updated_at.
   * @param id     - UUID of the target signal.
   * @param status - New status value.
   * @returns The updated signal, or undefined if the id was not found.
   */
  updateStatus(id: string, status: SignalStatus): EnrichedSignal | undefined;

  /**
   * Returns the number of signals currently in the store.
   * Used in tests to assert store state without calling getAll().
   */
  count(): number;

  /**
   * Removes all signals from the store.
   * Intended for test teardown only — not exposed via any HTTP endpoint.
   */
  clear(): void;

  /**
   * Returns a point-in-time snapshot of store metrics.
   * Consumed by the /health endpoint and future monitoring integrations.
   */
  getHealthSnapshot(): StoreHealthSnapshot;
}
