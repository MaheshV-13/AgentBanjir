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

export interface ISignalStore {
  /** Returns all stored signals as an array. */
  getAll(): Promise<EnrichedSignal[]>;

  /** Returns a single signal by its UUID, or undefined if not found. */
  getById(id: string): Promise<EnrichedSignal | undefined>;

  /** Inserts a new signal or replaces an existing one with the same id. */
  upsert(signal: EnrichedSignal): Promise<void>;

  /** Mutates the status of an existing signal and updates updated_at. */
  updateStatus(id: string, status: SignalStatus): Promise<EnrichedSignal | undefined>;

  /** Returns the number of signals currently in the store. */
  count(): Promise<number>;

  /** Removes all signals from the store. */
  clear(): Promise<void>;

  /** Returns a point-in-time snapshot of store metrics. */
  getHealthSnapshot(): Promise<StoreHealthSnapshot>;
}
