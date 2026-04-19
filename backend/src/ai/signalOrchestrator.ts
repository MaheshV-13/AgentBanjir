/**
 * @module ai/signalOrchestrator
 *
 * Member 1's primary integration export. The Team Lead's gateway replaces the
 * `processSignalStub` in routes/analyzeSignal.ts with this class:
 *
 *   // Replace in routes/analyzeSignal.ts:
 *   import { SignalOrchestrator } from "@/ai/signalOrchestrator";
 *   const orchestrator   = new SignalOrchestrator();
 *   member1Result        = await orchestrator.processSignal(validatedInput);
 *
 * ── Execution order ───────────────────────────────────────────────────────────
 *   1. Call GeminiExtractionService  → { location, severity_level,
 *                                        specific_needs, ai_confidence_score }
 *   2. Call VertexSearchGroundingService(location) → NearestBoat[]
 *      (step 2 is sequential — it depends on location from step 1)
 *   3. Merge, apply null-defaults, validate against PartialEnrichedSignalSchema.
 *   4. Return PartialEnrichedSignalSchemaType to the gateway.
 *
 * ── Return contract (PartialEnrichedSignalSchema — .strict()) ─────────────────
 *   {
 *     severity_level:      SeverityLevel   (required)
 *     ai_confidence_score: number          (required)
 *     specific_needs:      string[]        (required)
 *     nearest_boats?:      NearestBoat[]   (optional)
 *   }
 *   ⚠️  NO extra keys — the schema is .strict(). Any addition must be declared
 *       in PartialEnrichedSignalSchema AND PartialEnrichedSignalSchemaType first.
 *
 * ── Graceful degradation ──────────────────────────────────────────────────────
 *   - If Gemini fails     → hard throw (gateway catches → 502 upstream AI failure)
 *   - If RAG fails        → nearest_boats omitted, extraction result returned
 *   - If Gemini returns null fields → logged defaults applied (never crash)
 */

import { logger } from "@/logger/logger";
import { PartialEnrichedSignalSchema }
  from "@/schemas/enrichedSignalSchema";
import type { PartialEnrichedSignalSchemaType }
  from "@/schemas/enrichedSignalSchema";
import type { MasterInputSchemaType }
  from "@/schemas/masterInputSchema";

import { extractFromGemini }   from "@/ai/geminiExtractionService";
import { queryNearestBoats }   from "@/ai/vertexSearchGroundingService";

// ─────────────────────────────────────────────────────────────────────────────
// Null-default constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applied when Gemini returns null for severity_level.
 * "Low" is the safest default — it avoids triggering an erroneous SMS dispatch
 * for a High/Medium signal that Gemini couldn't classify.
 */
const DEFAULT_SEVERITY    = "Low"  as const;

/**
 * Applied when Gemini returns null for ai_confidence_score.
 * 0 signals to the operator dashboard that the AI has no confidence in
 * this result and that human review is essential.
 */
const DEFAULT_CONFIDENCE  = 0      as const;

// ─────────────────────────────────────────────────────────────────────────────
// SignalOrchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stateless orchestrator class — safe to instantiate once and reuse per request.
 * No instance state is mutated between calls.
 */
export class SignalOrchestrator {
  /**
   * Processes a validated distress signal through the full AI extraction and
   * RAG grounding pipeline, returning a partial enriched signal for the gateway.
   *
   * This is the single public integration surface for the Team Lead's gateway.
   * Replace `processSignalStub` in routes/analyzeSignal.ts with this method.
   *
   * @param input - Validated `MasterInputSchemaType` from the gateway's Zod parse.
   * @returns A `PartialEnrichedSignalSchemaType` containing AI-derived fields.
   *
   * @throws {Error} If Gemini extraction fails (network, quota, schema violation).
   *                 The gateway catches this and throws AppError 502.
   *
   * @example
   * ```typescript
   * import { SignalOrchestrator } from "@/ai/signalOrchestrator";
   *
   * const orchestrator = new SignalOrchestrator();
   * const result       = await orchestrator.processSignal(validatedInput);
   * // result.severity_level      → "High"
   * // result.ai_confidence_score → 87
   * // result.specific_needs      → ["insulin", "immediate rescue"]
   * // result.nearest_boats       → [{ boat_id: "BOAT-001", name: "Rescue Unit — Kampung Gajah", ... }]
   * ```
   */
  async processSignal(
    input: MasterInputSchemaType
  ): Promise<PartialEnrichedSignalSchemaType> {
    const startMs = Date.now();

    logger.info("[SignalOrchestrator] Processing signal", {
      has_image:      input.image_base64.length > 0,
      message_length: input.raw_message.length,
      gps:            input.gps_coordinates,
    });

    // ── Step 1: Gemini extraction ──────────────────────────────────────────
    // Hard failure — if Gemini is unavailable, we cannot produce a meaningful
    // result. The gateway will catch this and return a 502.
    const extraction = await extractFromGemini(input);

    // Apply null-defaults with logged warnings. The schema requires non-null
    // values for severity_level, ai_confidence_score, and specific_needs.
    const severity_level = extraction.severity_level ?? (() => {
      logger.warn(
        "[SignalOrchestrator] Gemini returned null severity_level — defaulting to 'Low'."
      );
      return DEFAULT_SEVERITY;
    })();

    const ai_confidence_score = extraction.ai_confidence_score ?? (() => {
      logger.warn(
        "[SignalOrchestrator] Gemini returned null ai_confidence_score — defaulting to 0."
      );
      return DEFAULT_CONFIDENCE;
    })();

    const specific_needs = extraction.specific_needs ?? (() => {
      logger.warn(
        "[SignalOrchestrator] Gemini returned null specific_needs — defaulting to []."
      );
      return [] as string[];
    })();

    // Low confidence threshold — warn so operators know to scrutinise this card.
    if (ai_confidence_score < 30) {
      logger.warn("[SignalOrchestrator] Low AI confidence score", {
        ai_confidence_score,
        severity_level,
      });
    }

    // ── Step 2: Vertex AI Search RAG (sequential — depends on location) ────
    // Soft failure — RAG unavailability must not block the extraction result.
    // The gateway renders nearest_boats as absent; operator dispatches manually.
    let nearest_boats: PartialEnrichedSignalSchemaType["nearest_boats"];

    try {
      const boats = await queryNearestBoats(
        extraction.location,
        input.gps_coordinates
      );
      // Only attach the field when results exist — keeps the response clean
      // and avoids an empty array cluttering the dashboard UI.
      if (boats.length > 0) {
        nearest_boats = boats;
      }
    } catch (ragError) {
      const reason = ragError instanceof Error ? ragError.message : String(ragError);
      logger.warn(
        "[SignalOrchestrator] Vertex AI Search failed — degrading gracefully.",
        { reason }
      );
      // nearest_boats remains undefined — gateway handles the omission.
    }

    // ── Step 3: Assemble + validate against the strict partial schema ──────
    // The .strict() Zod schema rejects any extra keys. We build the object
    // explicitly to guarantee zero stray properties from the extraction step.
    const partialResult: PartialEnrichedSignalSchemaType = {
      severity_level,
      ai_confidence_score,
      specific_needs,
      ...(nearest_boats !== undefined && { nearest_boats }),
    };

    // Runtime assertion — catches any contract drift between this module
    // and the schema during development. In production, a ZodError here
    // surfaces as a 500 to the gateway, which is intentional.
    PartialEnrichedSignalSchema.parse(partialResult);

    const durationMs = Date.now() - startMs;
    logger.info("[SignalOrchestrator] Signal processed successfully", {
      severity_level,
      ai_confidence_score,
      needs_count:   specific_needs.length,
      boats_found:   nearest_boats?.length ?? 0,
      duration_ms:   durationMs,
    });

    return partialResult;
  }
}
