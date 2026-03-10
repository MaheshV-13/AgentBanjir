/**
 * @module schemas/enrichedSignalSchema
 *
 * Zod schema for the EnrichedSignal output.
 *
 * Used in two contexts:
 *  1. As a parse/assertion guard in tests to verify the gateway's response shape.
 *  2. As a runtime safeguard before persisting to the store, catching any
 *     malformed partial results from Members 1 or 2 before they corrupt the DB.
 *
 * Mirrors the EnrichedSignal TypeScript interface in signal.types.ts exactly.
 * Any structural change here must be synchronised with that interface.
 */
import { z } from "zod";
import { GpsCoordinatesSchema } from "./masterInputSchema";

// ─── Atomic Value Schemas ─────────────────────────────────────────────────────

export const SeverityLevelSchema = z.enum(["Low", "Medium", "High"]);

export const SignalStatusSchema = z.enum([
  "Pending_Human_Review",
  "Dispatched",
  "Rejected",
]);

// ─── Nested Object Schemas ────────────────────────────────────────────────────
// All nested schemas carry .strict() so unknown keys are rejected at every
// level of the object tree, not just at the top-level envelope.

export const NearestBoatSchema = z.object({
  boat_id:        z.string().min(1),
  name:           z.string().min(1),
  distance_km:    z.number().nonnegative(),
  capacity:       z.number().int().positive(),
  current_status: z.enum(["Available", "Deployed", "Maintenance"]),
}).strict();

export const FlowActionSchema = z.object({
  tool:    z.string().min(1),
  success: z.boolean(),
  details: z.string(),
}).strict();

export const FlowResultSchema = z.object({
  recommended_status: SignalStatusSchema,
  actions_taken:      z.array(FlowActionSchema),
}).strict();

// ─── Enriched Signal Schema ───────────────────────────────────────────────────

export const EnrichedSignalSchema = z.object({
  /** UUID assigned by crypto.randomUUID() — must be a valid UUID v4 format. */
  id: z.string().uuid({ message: "id must be a valid UUID" }),

  gps_coordinates:     GpsCoordinatesSchema,

  severity_level:      SeverityLevelSchema,

  /**
   * AI confidence score. Validated as 0–100 integer range.
   * Values below ~30 should trigger a warn log at the call site.
   */
  ai_confidence_score: z
    .number()
    .min(0,   { message: "ai_confidence_score must be >= 0" })
    .max(100, { message: "ai_confidence_score must be <= 100" }),

  specific_needs: z.array(z.string()),

  status: SignalStatusSchema,

  created_at: z.string().datetime({ message: "created_at must be ISO 8601" }),
  updated_at: z.string().datetime({ message: "updated_at must be ISO 8601" }),

  // Optional fields — absent when upstream calls degrade gracefully.
  nearest_boats: z.array(NearestBoatSchema).optional(),
  flow_result:   FlowResultSchema.optional(),
}).strict();

/** Inferred TypeScript type — must structurally match EnrichedSignal in signal.types.ts. */
export type EnrichedSignalSchemaType = z.infer<typeof EnrichedSignalSchema>;

// ─── Partial Enriched Signal ──────────────────────────────────────────────────

/**
 * Partial schema used to validate Member 1's intermediate output before it
 * reaches the gateway's merge step. Only AI-derived fields are required here;
 * gateway-assigned fields (id, status, timestamps) are not yet present.
 *
 * ⚠️  CONTRACT WARNING FOR MEMBER 1:
 * This schema is .strict(). Member 1's SignalOrchestrator.processSignal() return
 * value must contain ONLY the four fields below — no extra diagnostic fields
 * (e.g. raw_gemini_response, processing_time_ms). Any additional keys will throw
 * a ZodError and return a 500. If Member 1 needs to pass diagnostics upstream,
 * add those fields to this schema AND to PartialEnrichedSignalSchemaType explicitly.
 */
export const PartialEnrichedSignalSchema = EnrichedSignalSchema.pick({
  severity_level:      true,
  ai_confidence_score: true,
  specific_needs:      true,
}).extend({
  nearest_boats: z.array(NearestBoatSchema).optional(),
}).strict();

export type PartialEnrichedSignalSchemaType = z.infer<typeof PartialEnrichedSignalSchema>;
