/**
 * @module routes/analyzeSignal.route
 *
 * POST /api/v1/analyze-signal
 *
 * Primary orchestration endpoint. Accepts a raw distress signal, validates it,
 * delegates to Members 1 and 2's internal modules, persists the enriched result,
 * and returns the fully-structured EnrichedSignal JSON.
 *
 * The handler is deliberately thin — all AI logic lives in Member 1 & 2's modules.
 * This file only manages: validation → delegation → merge → persist → respond.
 *
 * Member 1 stub: SignalOrchestrator.processSignal()
 * Member 2 stub: floodCrisisOrchestrationFlow()
 * Both are imported as standard TypeScript functions per clarification item #2.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { analyzeSignalLimit } from "@/middleware/rateLimitConfig";
import { MasterInputSchema }  from "@/schemas/masterInputSchema";
import { signalStore }        from "@/store/signalStore";
import { AppError }           from "@/middleware/globalErrorHandler";
import { logger }             from "@/logger/logger";
import { runFloodCrisisOrchestration } from "@/genkit/flows/floodCrisisOrchestrationFlow";
import type {
  MasterInputSignal,
  EnrichedSignal,
} from "@/types/signal.types";

// ─── Member 1 & 2 Integration Stubs ──────────────────────────────────────────
// These imports will resolve to real implementations once Members 1 and 2
// deliver their modules. Interface contracts are defined in signal.types.ts.
//
// Per the Cross-Team Integration Registry (SDD §16):
//   Member 1: SignalOrchestrator.processSignal(input) → Partial<EnrichedSignal>
//   Member 2: floodCrisisOrchestrationFlow(signal)    → FlowResult
//
// TODO(Member4): Replace stub imports with real module paths when available.
// import { SignalOrchestrator }             from "@member1/signalOrchestrator";
// import { floodCrisisOrchestrationFlow }   from "@member2/floodCrisisFlow";

/** Temporary stub — Member 1's Gemini extraction + RAG module (to be replaced). */
async function processSignalStub(
  input: MasterInputSignal
): Promise<Partial<EnrichedSignal>> {
  // This stub returns placeholder data so the gateway can be tested independently.
  // Remove when Member 1's real SignalOrchestrator is integrated.
  void input; // suppress unused param lint until real implementation
  return {
    severity_level:      "High",
    ai_confidence_score: 92,
    specific_needs:      ["life_jacket", "medical_assistance"],
    nearest_boats:       [],
  };
}



// ─── Router ───────────────────────────────────────────────────────────────────

export const analyzeSignalRouter = Router();

/**
 * @route   POST /api/v1/analyze-signal
 * @desc    Submit a distress signal for AI triage and agentic orchestration.
 * @body    MasterInputSignal (validated via Zod MasterInputSchema)
 * @returns EnrichedSignal
 * @access  Public (no auth — login-free per clarification #7)
 */
analyzeSignalRouter.post(
  "/",
  analyzeSignalLimit,  // Stricter 10 req / 15 min per IP for Gemini-backed endpoint.
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = res.locals["requestId"] as string;

      // ── Step 1: Validate Input ─────────────────────────────────────────────
      // Zod parse throws ZodError on failure → caught by globalErrorHandler → 400.
      const validatedInput: MasterInputSignal = MasterInputSchema.parse(req.body);

      logger.debug("Signal input validated", { req_id: requestId });

      // ── Step 2: Member 1 — Gemini Extraction + RAG ─────────────────────────
      let member1Result: Partial<EnrichedSignal>;
      try {
        member1Result = await processSignalStub(validatedInput);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Member 1 SignalOrchestrator failure", { req_id: requestId, error: msg });
        throw new AppError("UPSTREAM_AI_FAILURE", "AI extraction service unavailable.", 502);
      }

      // ── Step 3: Gateway — Base Signal Construction (UUID Assignment) ───────
      // We must construct the EnrichedSignal FIRST because Member 2's flow
      // requires the generated `id` to log to the DB and send SMS messages.
      const now = new Date().toISOString();
      let enrichedSignal: EnrichedSignal = {
        id:                  crypto.randomUUID(),
        gps_coordinates:     validatedInput.gps_coordinates,
        severity_level:      member1Result.severity_level      ?? "Low",
        ai_confidence_score: member1Result.ai_confidence_score ?? 0,
        specific_needs:      member1Result.specific_needs      ?? [],
        nearest_boats:       member1Result.nearest_boats,
        status:              "Pending_Human_Review", // Default starting status
        created_at:          now,
        updated_at:          now,
      };

      // ── Step 4: Member 2 — Genkit Orchestration Flow (LIVE) ────────────────
      try {
        const flowResult = await runFloodCrisisOrchestration(enrichedSignal);
        
        // Merge the autonomous decisions back into our signal
        enrichedSignal = {
          ...enrichedSignal,
          status:      flowResult.recommended_status,
          flow_result: flowResult,
          updated_at:  new Date().toISOString(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("Member 2 Genkit flow failure — degraded mode", {
          req_id:   requestId,
          error:    msg,
          fallback: "Pending_Human_Review",
        });
        // On total flow crash, we degrade gracefully and keep the default status
        enrichedSignal.flow_result = {
          recommended_status: "Pending_Human_Review",
          actions_taken:      [{ tool: "system", success: false, details: "Flow crashed" }],
        };
      }

      // ── Step 5: Persist to In-Memory Store ─────────────────────────────────
      signalStore.upsert(enrichedSignal);

      // ── Step 6: Log Milestone + Respond ────────────────────────────────────
      logger.info("POST /api/v1/analyze-signal", {
        req_id:      requestId,
        incident_id: enrichedSignal.id,
        severity:    enrichedSignal.severity_level,
        status:      enrichedSignal.status,
      });

      res.status(200).json(enrichedSignal);
    } catch (err) {
      next(err);
    }
  }
);
