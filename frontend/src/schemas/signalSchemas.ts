import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — Zod Runtime Validation Schemas
//
// These schemas are the runtime mirror of src/types/signal.types.ts.
// They are used exclusively at the Axios interceptor layer (apiClient.ts) to
// validate every API response before it reaches the React component tree.
//
// RULE: A failed parse must NEVER crash the UI. Every schema consumer should
// use .safeParse() and handle the error branch gracefully (log + fallback).
//
// Inferred TypeScript types (z.infer<typeof Schema>) are exported alongside
// the schemas. For shared interfaces that need JSDoc or extra modifiers, keep
// the hand-written types in signal.types.ts and use the Zod types internally.
// ─────────────────────────────────────────────────────────────────────────────

// ── Primitives ───────────────────────────────────────────────────────────────

/**
 * GPS coordinate pair. Both values are finite numbers.
 * Latitude: –90 to +90. Longitude: –180 to +180.
 * Malaysia bounding box: lat 0.85–7.4, lng 99.6–119.3 — validated loosely
 * here to avoid false rejections from test data outside Malaysia.
 */
export const GpsCoordinatesSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
})

export type GpsCoordinatesZ = z.infer<typeof GpsCoordinatesSchema>

// ── Enums ────────────────────────────────────────────────────────────────────

export const SeverityLevelSchema = z.enum(['Low', 'Medium', 'High'])

export const SignalStatusSchema = z.enum([
  'Pending_Human_Review',
  'Dispatched',
  'Rejected',
])

export const FilterOptionSchema = z.enum(['All', 'High', 'Pending', 'Dispatched'])

// ── Enriched Signal (GET /api/v1/signals array items) ────────────────────────

/**
 * Runtime schema for a single enriched signal returned by the backend.
 *
 * Validation rules:
 *  - id:                  non-empty string
 *  - ai_confidence_score: 0–100 integer (clamped, not rejected, if float)
 *  - specific_needs:      array of non-empty strings; empty array is valid
 *  - created_at:          optional ISO-8601 datetime string
 *  - raw_message:         optional, trimmed
 */
export const EnrichedSignalSchema = z.object({
  id: z.string().min(1, 'Signal id must be a non-empty string'),

  gps_coordinates: GpsCoordinatesSchema,

  severity_level: SeverityLevelSchema,

  ai_confidence_score: z
    .number()
    .finite()
    .min(0)
    .max(100)
    .transform((v) => Math.round(v)), // normalise floats like 87.6 → 88

  specific_needs: z.array(z.string().min(1)).default([]),

  status: SignalStatusSchema,

  created_at: z
    .string()
    .datetime({ offset: true }) // accepts both Z and +08:00 offsets
    .optional(),

  raw_message: z.string().trim().optional(),
})

export type EnrichedSignalZ = z.infer<typeof EnrichedSignalSchema>

// ── Signal List Response (GET /api/v1/signals) ────────────────────────────────

/**
 * Top-level response envelope for the signal feed poll.
 *
 * Handles two backend shapes gracefully:
 *  - { signals: [...] }   — preferred envelope
 *  - [...]                — bare array (fallback if Member 2 omits wrapper)
 *
 * The .transform() normalises both to { signals: EnrichedSignal[] }.
 */
export const SignalListResponseSchema = z
  .union([
    // Preferred: wrapped envelope
    z.object({
      signals: z.array(EnrichedSignalSchema),
    }),
    // Fallback: bare array
    z.array(EnrichedSignalSchema).transform((signals) => ({ signals })),
  ])
  .transform((data) => ({
    // Filter out any individual signals that failed partial validation
    // (extra safety — union above already validates each item)
    signals: data.signals,
  }))

export type SignalListResponseZ = z.infer<typeof SignalListResponseSchema>

// ── Master Input Signal (POST /api/v1/analyze-signal request body) ────────────

/**
 * Validates the victim-side form payload BEFORE submission.
 * Used in SignalSubmissionForm to surface field-level errors in the UI.
 *
 * Validation rules:
 *  - raw_message:          1–500 chars (prevents accidental empty submissions)
 *  - image_base64:         must start with a valid data-URI prefix OR be empty
 *                          (image is optional in the demo form)
 *  - simulated_user_verified: boolean, defaults false
 */
export const MasterInputSignalSchema = z.object({
  gps_coordinates: GpsCoordinatesSchema,

  image_base64: z
    .string()
    .refine(
      (v) => v === '' || v.startsWith('data:image/'),
      'image_base64 must be a valid data-URI or empty string',
    )
    .default(''),

  raw_message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message must be 500 characters or fewer'),

  simulated_user_verified: z.boolean().default(false),
})

export type MasterInputSignalZ = z.infer<typeof MasterInputSignalSchema>

// ── Status Update Payload (PATCH /api/v1/signals/:id/status) ─────────────────

export const StatusUpdatePayloadSchema = z.object({
  status: z.enum(['Dispatched', 'Rejected']),
})

export type StatusUpdatePayloadZ = z.infer<typeof StatusUpdatePayloadSchema>

// ── Analyse Signal Response (POST /api/v1/analyze-signal response) ───────────

/**
 * The backend returns the freshly enriched signal immediately after POST.
 * We validate it with the same EnrichedSignalSchema so it can be upserted
 * directly into the feed without a separate poll cycle.
 */
export const AnalyseSignalResponseSchema = EnrichedSignalSchema

export type AnalyseSignalResponseZ = z.infer<typeof AnalyseSignalResponseSchema>

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Safely parse an unknown API response as a SignalListResponse.
 * Returns { success: true, data } or { success: false, error, fallback }.
 * The fallback is always a valid empty signal list so callers never crash.
 */
export function parseSignalListResponse(raw: unknown):
  | { success: true; data: SignalListResponseZ }
  | { success: false; error: z.ZodError; fallback: SignalListResponseZ } {
  const result = SignalListResponseSchema.safeParse(raw)
  if (result.success) {
    return { success: true, data: result.data }
  }
  console.error('[AgentBanjir] SignalListResponse parse failed:', result.error.flatten())
  return {
    success: false,
    error: result.error,
    fallback: { signals: [] },
  }
}

/**
 * Safely parse a single enriched signal (used after PATCH optimistic rollback).
 */
export function parseEnrichedSignal(raw: unknown):
  | { success: true; data: EnrichedSignalZ }
  | { success: false; error: z.ZodError } {
  const result = EnrichedSignalSchema.safeParse(raw)
  if (result.success) return { success: true, data: result.data }
  console.error('[AgentBanjir] EnrichedSignal parse failed:', result.error.flatten())
  return { success: false, error: result.error }
}

/**
 * Validates the submission form payload and returns field-level errors
 * in a shape React Hook Form / manual form state can consume directly.
 */
export function validateMasterInput(raw: unknown):
  | { valid: true; data: MasterInputSignalZ }
  | { valid: false; fieldErrors: Partial<Record<keyof MasterInputSignalZ, string>> } {
  const result = MasterInputSignalSchema.safeParse(raw)
  if (result.success) return { valid: true, data: result.data }

  const fieldErrors: Partial<Record<keyof MasterInputSignalZ, string>> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof MasterInputSignalZ
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message
    }
  }
  return { valid: false, fieldErrors }
}