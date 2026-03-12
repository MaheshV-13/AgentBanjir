/**
 * @module genkit/flows/floodCrisisOrchestrationFlow
 *
 * Core Genkit `defineFlow` — the autonomous decision engine for AgentBanjir.
 *
 * ── Input ─────────────────────────────────────────────────────────────────────
 * EnrichedSignal — the full signal object assembled by the gateway after
 * Member 1's AI extraction. All required fields (id, severity_level,
 * gps_coordinates, specific_needs) are guaranteed present by the gateway
 * before this flow is invoked.
 *
 * ── Output ───────────────────────────────────────────────────────────────────
 * FlowResult — matches the FlowResult interface in @/types/signal.types exactly:
 *   { recommended_status: SignalStatus, actions_taken: FlowAction[] }
 *
 * The gateway stores this in EnrichedSignal.flow_result and updates
 * EnrichedSignal.status to recommended_status before calling signalStore.upsert().
 *
 * ── Monorepo export ───────────────────────────────────────────────────────────
 * The Team Lead imports `runFloodCrisisOrchestration` from this file and calls
 * it directly — no HTTP transport layer in this module.
 *
 *   import { runFloodCrisisOrchestration } from "@/genkit/flows/floodCrisisOrchestrationFlow";
 *   const flowResult = await runFloodCrisisOrchestration(enrichedSignal);
 *
 * ── Severity routing matrix (SDD §8.1) ───────────────────────────────────────
 *   "High"   → SMS dispatch + DB log (queue: urgent)   → status: "Dispatched"
 *   "Medium" → DB log only  (queue: standard)          → status: "Pending_Human_Review"
 *   "Low"    → DB log only  (queue: low)               → status: "Pending_Human_Review"
 *   unknown  → DB log only  (queue: standard)          → status: "Pending_Human_Review"
 *
 * ── Fault tolerance (SDD §8.3) ───────────────────────────────────────────────
 * If dispatchSmsRescuerTool throws:
 *   1. Error is caught — not propagated to the caller
 *   2. Falls back to DB log with status "Pending_Human_Review"
 *   3. WARN log emitted with failure reason (no PII)
 *   4. Gracefully degraded FlowResult returned — never a hard failure
 */
import { ai } from "@/genkit/genkit.config";
import { logger } from "@/logger/logger";
import { dispatchSmsRescuerTool } from "@/genkit/tools/dispatchSmsRescuerTool";
import { logEventToDatabaseTool } from "@/genkit/tools/logEventToDatabaseTool";
import {
  EnrichedSignalSchema,
  FlowResultSchema,
} from "@/genkit/schemas/agentSchemas";
import type {
  EnrichedSignal,
  FlowResult,
  FlowAction,
  SignalStatus,
} from "@/types/signal.types";

// ─────────────────────────────────────────────────────────────────────────────
// Flow definition
// ─────────────────────────────────────────────────────────────────────────────

export const floodCrisisOrchestrationFlow = ai.defineFlow(
  {
    name:         "floodCrisisOrchestrationFlow",
    inputSchema:  EnrichedSignalSchema,
    outputSchema: FlowResultSchema,
  },
  async (signal: EnrichedSignal): Promise<FlowResult> => {
    const flowStart = Date.now();
    const actionsTaken: FlowAction[] = [];

    logger.info("[floodCrisisOrchestrationFlow] Flow started", {
      incident_id:         signal.id,
      severity_level:      signal.severity_level,
      ai_confidence_score: signal.ai_confidence_score,
    });

    const severity = signal.severity_level;

    // ─── Path A: High severity ────────────────────────────────────────────────
    if (severity === "High") {
      logger.info(
        "[floodCrisisOrchestrationFlow] HIGH severity — attempting SMS dispatch",
        { incident_id: signal.id }
      );

      let recommendedStatus: SignalStatus = "Dispatched";

      // Step 1: Attempt SMS dispatch (blocking — must complete before DB log)
      try {
        const smsReceipt = await dispatchSmsRescuerTool({
          incident_id:     signal.id,
          severity_level:  signal.severity_level,
          gps_coordinates: signal.gps_coordinates,
          specific_needs:  signal.specific_needs,
        });

        actionsTaken.push({
          tool:    "dispatchSmsRescuerTool",
          success: true,
          details: `SMS dispatched. message_id=${smsReceipt.message_id}`,
        });
      } catch (smsError) {
        // Graceful degradation — SMS failure must NOT block DB log or crash flow
        const reason = smsError instanceof Error ? smsError.message : String(smsError);
        logger.warn(
          "[floodCrisisOrchestrationFlow] SMS dispatch FAILED — degrading gracefully",
          { incident_id: signal.id, reason }
        );
        actionsTaken.push({
          tool:    "dispatchSmsRescuerTool",
          success: false,
          details: `SMS dispatch failed: ${reason}`,
        });
        recommendedStatus = "Pending_Human_Review";
      }

      // Step 2: DB log always runs after High severity (urgent queue)
      try {
        const dbReceipt = await logEventToDatabaseTool({
          incident_id:     signal.id,
          severity_level:  signal.severity_level,
          gps_coordinates: signal.gps_coordinates,
          specific_needs:  signal.specific_needs,
          status:          recommendedStatus,
          queue:           "urgent",
        });
        actionsTaken.push({
          tool:    "logEventToDatabaseTool",
          success: true,
          details: `Event logged. log_id=${dbReceipt.log_id} queue=urgent`,
        });
      } catch (dbError) {
        const reason = dbError instanceof Error ? dbError.message : String(dbError);
        logger.error(
          "[floodCrisisOrchestrationFlow] DB log FAILED for High severity",
          { incident_id: signal.id, reason }
        );
        actionsTaken.push({
          tool:    "logEventToDatabaseTool",
          success: false,
          details: `DB log failed: ${reason}`,
        });
      }

      return _assembleResult(signal.id, recommendedStatus, actionsTaken, flowStart);
    }

    // ─── Path B: Medium severity ──────────────────────────────────────────────
    if (severity === "Medium") {
      logger.info(
        "[floodCrisisOrchestrationFlow] MEDIUM severity — DB log, standard queue",
        { incident_id: signal.id }
      );

      try {
        const dbReceipt = await logEventToDatabaseTool({
          incident_id:     signal.id,
          severity_level:  signal.severity_level,
          gps_coordinates: signal.gps_coordinates,
          specific_needs:  signal.specific_needs,
          status:          "Pending_Human_Review",
          queue:           "standard",
        });
        actionsTaken.push({
          tool:    "logEventToDatabaseTool",
          success: true,
          details: `Event logged. log_id=${dbReceipt.log_id} queue=standard`,
        });
      } catch (dbError) {
        const reason = dbError instanceof Error ? dbError.message : String(dbError);
        logger.error(
          "[floodCrisisOrchestrationFlow] DB log FAILED for Medium severity",
          { incident_id: signal.id, reason }
        );
        actionsTaken.push({
          tool:    "logEventToDatabaseTool",
          success: false,
          details: `DB log failed: ${reason}`,
        });
      }

      return _assembleResult(signal.id, "Pending_Human_Review", actionsTaken, flowStart);
    }

    // ─── Path C: Low severity ─────────────────────────────────────────────────
    if (severity === "Low") {
      logger.info(
        "[floodCrisisOrchestrationFlow] LOW severity — DB log, low-priority queue",
        { incident_id: signal.id }
      );

      try {
        const dbReceipt = await logEventToDatabaseTool({
          incident_id:     signal.id,
          severity_level:  signal.severity_level,
          gps_coordinates: signal.gps_coordinates,
          specific_needs:  signal.specific_needs,
          status:          "Pending_Human_Review",
          queue:           "low",
        });
        actionsTaken.push({
          tool:    "logEventToDatabaseTool",
          success: true,
          details: `Event logged. log_id=${dbReceipt.log_id} queue=low`,
        });
      } catch (dbError) {
        const reason = dbError instanceof Error ? dbError.message : String(dbError);
        logger.error(
          "[floodCrisisOrchestrationFlow] DB log FAILED for Low severity",
          { incident_id: signal.id, reason }
        );
        actionsTaken.push({
          tool:    "logEventToDatabaseTool",
          success: false,
          details: `DB log failed: ${reason}`,
        });
      }

      return _assembleResult(signal.id, "Pending_Human_Review", actionsTaken, flowStart);
    }

    // ─── Path D: Unknown severity — safe default, never auto-dispatch ─────────
    // TypeScript's strict enum on EnrichedSignalSchema means this branch should
    // never be reached at runtime. Guarded defensively per SDD §8.2.
    logger.warn(
      "[floodCrisisOrchestrationFlow] UNKNOWN severity — defaulting to safe path",
      { incident_id: signal.id, received_severity: severity }
    );

    try {
      const dbReceipt = await logEventToDatabaseTool({
        incident_id:     signal.id,
        severity_level:  signal.severity_level,
        gps_coordinates: signal.gps_coordinates,
        specific_needs:  signal.specific_needs,
        status:          "Pending_Human_Review",
        queue:           "standard",
      });
      actionsTaken.push({
        tool:    "logEventToDatabaseTool",
        success: true,
        details: `Event logged (unknown severity fallback). log_id=${dbReceipt.log_id}`,
      });
    } catch (dbError) {
      const reason = dbError instanceof Error ? dbError.message : String(dbError);
      actionsTaken.push({
        tool:    "logEventToDatabaseTool",
        success: false,
        details: `DB log failed on unknown severity path: ${reason}`,
      });
    }

    return _assembleResult(signal.id, "Pending_Human_Review", actionsTaken, flowStart);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function _assembleResult(
  incidentId:          string,
  recommendedStatus:   SignalStatus,
  actionsTaken:        FlowAction[],
  flowStartMs:         number
): FlowResult {
  const durationMs = Date.now() - flowStartMs;

  logger.info("[floodCrisisOrchestrationFlow] Flow complete", {
    incident_id:        incidentId,
    recommended_status: recommendedStatus,
    actions_count:      actionsTaken.length,
    duration_ms:        durationMs,
  });

  return {
    recommended_status: recommendedStatus,
    actions_taken:      actionsTaken,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export — callable by the Team Lead's gateway
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Direct invocation wrapper for use in the monorepo gateway.
 *
 * @example Gateway usage (Team Lead's route handler):
 * ```typescript
 * import { runFloodCrisisOrchestration } from "@/genkit/flows/floodCrisisOrchestrationFlow";
 *
 * const flowResult = await runFloodCrisisOrchestration(enrichedSignal);
 * // flowResult: { recommended_status, actions_taken }
 *
 * const finalSignal: EnrichedSignal = {
 *   ...enrichedSignal,
 *   status:      flowResult.recommended_status,
 *   flow_result: flowResult,
 *   updated_at:  new Date().toISOString(),
 * };
 * signalStore.upsert(finalSignal);
 * ```
 */
export async function runFloodCrisisOrchestration(
  input: EnrichedSignal
): Promise<FlowResult> {
  return floodCrisisOrchestrationFlow(input);
}
