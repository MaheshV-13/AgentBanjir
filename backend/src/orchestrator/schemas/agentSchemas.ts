/**
 * @module genkit/schemas/agentSchemas
 *
 * Zod schemas scoped to Member 2's tool I/O contracts.
 *
 * ── What lives here ───────────────────────────────────────────────────────────
 * Only schemas that are UNIQUE to the Genkit tools (SMS dispatch and DB log).
 * These are not shared outside the genkit/ module.
 *
 * ── What does NOT live here ───────────────────────────────────────────────────
 * - EnrichedSignalSchema  → already in @/schemas/enrichedSignalSchema (flow input)
 * - FlowResultSchema      → already in @/schemas/enrichedSignalSchema (flow output)
 * - All shared types      → @/types/signal.types
 *
 * Importing from the project's existing schemas prevents contract drift and
 * avoids redefining schemas that are already used by the gateway and tests.
 */
import { z } from "zod";

// ── Re-export for convenience so flow/tool files have one local import ─────────
export {
  EnrichedSignalSchema,
  FlowResultSchema,
  FlowActionSchema,
  SeverityLevelSchema,
  SignalStatusSchema,
} from "@/schemas/enrichedSignalSchema";

// ─────────────────────────────────────────────────────────────────────────────
// dispatchSmsRescuerTool — Input / Output schemas
// ─────────────────────────────────────────────────────────────────────────────

export const SmsDispatchInputSchema = z
  .object({
    incident_id:     z.string().uuid(),
    severity_level:  z.enum(["Low", "Medium", "High"]),
    gps_coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    specific_needs: z.array(z.string()),
  })
  .strict();

export type SmsDispatchInput = z.infer<typeof SmsDispatchInputSchema>;

export const SmsDispatchOutputSchema = z
  .object({
    success:              z.boolean(),
    /** Simulated UUID message ID (production: Twilio MessageSid) */
    message_id:           z.string(),
    /** Mock phone number; in production resolved from rescue coordinator registry */
    simulated_recipient:  z.string(),
    dispatched_at:        z.string().datetime(),
  })
  .strict();

export type SmsDispatchOutput = z.infer<typeof SmsDispatchOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// logEventToDatabaseTool — Input / Output schemas
// ─────────────────────────────────────────────────────────────────────────────

export const DbLogInputSchema = z
  .object({
    incident_id:     z.string().uuid(),
    severity_level:  z.enum(["Low", "Medium", "High"]),
    gps_coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    specific_needs:  z.array(z.string()),
    status:          z.enum(["Pending_Human_Review", "Dispatched", "Rejected"]),
    queue:           z.enum(["urgent", "standard", "low"]),
  })
  .strict();

export type DbLogInput = z.infer<typeof DbLogInputSchema>;

export const DbLogOutputSchema = z
  .object({
    success:   z.boolean(),
    /** Simulated log record ID (production: Firestore document ID) */
    log_id:    z.string(),
    queue:     z.enum(["urgent", "standard", "low"]),
    logged_at: z.string().datetime(),
  })
  .strict();

export type DbLogOutput = z.infer<typeof DbLogOutputSchema>;
