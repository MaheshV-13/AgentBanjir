/**
 * @module store/signalStore
 *
 * In-memory signal store — Map-backed ISignalStore implementation.
 *
 * For hackathon scope, a Map<string, EnrichedSignal> serves as the signal DB.
 * The ISignalStore interface (defined in signalStore.types.ts) makes this
 * implementation trivially swappable with a Firestore adapter in production
 * without changing any route handler code.
 *
 * Thread-safety note: Node.js is single-threaded; the Map is safe for
 * concurrent async access within a single Cloud Run container instance.
 */
import type { EnrichedSignal, SeverityLevel, SignalStatus } from "@/types/signal.types";
import type {
  ISignalStore,
  StoreHealthSnapshot,
} from "@/store/signalStore.types";

// ─── In-Memory Implementation ─────────────────────────────────────────────────

/**
 * Map-backed in-memory implementation of ISignalStore.
 * Exported as a singleton — all routes share the same instance.
 */
class InMemorySignalStore implements ISignalStore {
  private readonly store = new Map<string, EnrichedSignal>();

  /** {@inheritDoc ISignalStore.getAll} */
  getAll(): EnrichedSignal[] {
    return Array.from(this.store.values());
  }

  /** {@inheritDoc ISignalStore.getById} */
  getById(id: string): EnrichedSignal | undefined {
    return this.store.get(id);
  }

  /** {@inheritDoc ISignalStore.upsert} */
  upsert(signal: EnrichedSignal): void {
    this.store.set(signal.id, signal);
  }

  /** {@inheritDoc ISignalStore.updateStatus} */
  updateStatus(id: string, status: SignalStatus): EnrichedSignal | undefined {
    const existing = this.store.get(id);
    if (!existing) return undefined;

    // Construct a new object rather than mutating in place; aids debugging.
    const updated: EnrichedSignal = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return updated;
  }

  /** {@inheritDoc ISignalStore.count} */
  count(): number {
    return this.store.size;
  }

  /** {@inheritDoc ISignalStore.clear} */
  clear(): void {
    this.store.clear();
  }

  /** {@inheritDoc ISignalStore.getHealthSnapshot} */
  getHealthSnapshot(): StoreHealthSnapshot {
    const signals = this.getAll();

    // Initialise all counters to 0 so the snapshot is always fully populated,
    // even if no signals of a given severity/status have been seen yet.
    const by_severity: Record<SeverityLevel, number> = { High: 0, Medium: 0, Low: 0 };
    const by_status: Record<SignalStatus, number> = {
      Pending_Human_Review: 0,
      Dispatched:           0,
      Rejected:             0,
    };

    for (const signal of signals) {
      by_severity[signal.severity_level] += 1;
      by_status[signal.status]           += 1;
    }

    return {
      total_signals:     signals.length,
      by_severity,
      by_status,
      snapshot_taken_at: new Date().toISOString(),
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Singleton signal store instance.
 * Import this in route handlers:
 *   import { signalStore } from "@/store/signalStore";
 *
 * Import the interface for type annotations:
 *   import type { ISignalStore } from "@/store/signalStore.types";
 */
export const signalStore: ISignalStore = new InMemorySignalStore();
