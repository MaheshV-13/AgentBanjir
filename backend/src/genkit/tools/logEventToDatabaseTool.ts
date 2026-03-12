/**
 * @module genkit/tools/logEventToDatabaseTool
 *
 * Genkit `defineTool` — simulates writing a flood incident event to a
 * persistent database store.
 *
 * ── Trigger ───────────────────────────────────────────────────────────────────
 * Called for ALL severity levels. Always runs (including after SMS for High).
 *
 * ── Why a separate in-memory log, not signalStore? ───────────────────────────
 * signalStore (src/store/signalStore.ts) is the gateway's signal lifecycle store.
 * This tool simulates a separate "dispatch events" audit log — a distinct
 * collection in a production Firestore schema. Merging them would couple
 * Member 2's tool to the gateway's store interface, violating the boundary
 * defined in SDD §2.1.
 *
 * ── Simulation (hackathon scope) ─────────────────────────────────────────────
 * Appends records to an in-memory array for the lifetime of the process.
 * Resets on server restart — intentional per clarification #3.
 * Exported helpers allow Jest tests to assert and reset state cleanly.
 *
 * ── Production path ───────────────────────────────────────────────────────────
 * Replace the simulation block with:
 *   await admin.firestore()
 *     .collection("dispatch_events")
 *     .doc(log_id)
 *     .set(record);
 */
import { v4 as uuidv4 } from "uuid";
import { ai } from "@/genkit/genkit.config";
import { logger } from "@/logger/logger";
import {
  DbLogInputSchema,
  DbLogOutputSchema,
  type DbLogInput,
  type DbLogOutput,
} from "@/genkit/schemas/agentSchemas";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory dispatch event log (simulation only)
// ─────────────────────────────────────────────────────────────────────────────

interface DispatchEventRecord extends DbLogInput {
  log_id:    string;
  logged_at: string;
}

/** Module-scoped in-memory store. Exported for tests and dev/demo inspection. */
export const IN_MEMORY_DISPATCH_LOG: DispatchEventRecord[] = [];

/** Returns a read-only snapshot of the current log. Safe to call from tests. */
export const getDispatchLogSnapshot = (): ReadonlyArray<DispatchEventRecord> =>
  [...IN_MEMORY_DISPATCH_LOG];

/**
 * Clears the in-memory log.
 * Use ONLY in Jest afterEach/afterAll teardown — never in production code.
 */
export const clearDispatchLogForTests = (): void => {
  IN_MEMORY_DISPATCH_LOG.splice(0, IN_MEMORY_DISPATCH_LOG.length);
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool definition
// ─────────────────────────────────────────────────────────────────────────────

export const logEventToDatabaseTool = ai.defineTool(
  {
    name: "logEventToDatabaseTool",
    description:
      "Simulates writing a flood incident event to the dispatch audit log. " +
      "Triggered for all severity levels. " +
      "Assigns the incident to a priority queue and returns a log confirmation.",
    inputSchema:  DbLogInputSchema,
    outputSchema: DbLogOutputSchema,
  },
  async (input): Promise<DbLogOutput> => {
    const { incident_id, severity_level, queue, status } = input;

    logger.info("[logEventToDatabaseTool] Writing incident to dispatch log", {
      incident_id,
      severity_level,
      queue,
      status,
    });

    // ── Simulation block ──────────────────────────────────────────────────────
    // Production: replace with a Firestore write to "dispatch_events/{log_id}".
    const logId    = uuidv4();
    const loggedAt = new Date().toISOString();

    // Simulate DB write latency
    await new Promise((resolve) => setTimeout(resolve, 30));

    IN_MEMORY_DISPATCH_LOG.push({ ...input, log_id: logId, logged_at: loggedAt });

    logger.info("[logEventToDatabaseTool] Incident logged (simulated)", {
      incident_id,
      log_id:              logId,
      queue,
      logged_at:           loggedAt,
      total_log_entries:   IN_MEMORY_DISPATCH_LOG.length,
    });

    return {
      success:   true,
      log_id:    logId,
      queue,
      logged_at: loggedAt,
    };
    // ── End simulation block ──────────────────────────────────────────────────
  }
);
