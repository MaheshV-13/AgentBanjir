/**
 * @module tests/helpers/fixtures
 *
 * Shared test fixtures and factory helpers.
 *
 * Centralising fixture creation prevents test files from diverging on
 * what constitutes a "valid" signal, which would make schema changes
 * silently break only some tests. All test files import from here.
 */
import type { MasterInputSignal, EnrichedSignal } from "@/types/signal.types";

// ─── Master Input Signal Fixtures ─────────────────────────────────────────────

/**
 * Returns a complete, valid MasterInputSignal that passes Zod validation.
 * Override individual fields by spreading:
 *   buildValidInput({ gps_coordinates: { lat: 0, lng: 0 } })
 */
export function buildValidInput(
  overrides: Partial<MasterInputSignal> = {}
): MasterInputSignal {
  return {
    gps_coordinates:         { lat: 1.5535, lng: 103.7768 }, // UTM, Johor Bahru
    image_base64:            "a".repeat(200),                 // Minimal valid base64 stub
    raw_message:             "Tolong! Air dah naik paras pinggang. Ada 3 orang.",
    simulated_user_verified: true,
    ...overrides,
  };
}

// ─── Enriched Signal Fixtures ─────────────────────────────────────────────────

/**
 * Returns a complete, valid EnrichedSignal as the gateway would produce it.
 * UUID is deterministic for test assertions — do not rely on it for uniqueness.
 */
export function buildEnrichedSignal(
  overrides: Partial<EnrichedSignal> = {}
): EnrichedSignal {
  const now = new Date().toISOString();
  return {
    id:                  "550e8400-e29b-41d4-a716-446655440000",
    gps_coordinates:     { lat: 1.5535, lng: 103.7768 },
    severity_level:      "High",
    ai_confidence_score: 92,
    specific_needs:      ["life_jacket", "medical_assistance"],
    status:              "Pending_Human_Review",
    created_at:          now,
    updated_at:          now,
    flow_result: {
      recommended_status: "Pending_Human_Review",
      actions_taken: [
        { tool: "db_log_tool", success: true, details: "Logged to incident DB" },
      ],
    },
    ...overrides,
  };
}

// ─── Invalid Input Variants ───────────────────────────────────────────────────

/**
 * Collection of bodies that must each produce a 400 VALIDATION_ERROR response.
 *
 * Typed as Record<string, unknown> rather than unknown: every case is an object
 * literal, and this type satisfies Supertest's .send() signature in strict mode
 * without requiring a cast at every call site.
 */
export const INVALID_INPUT_CASES: Array<{ label: string; body: object }> = [
  {
    label: "missing gps_coordinates",
    body:  { image_base64: "a".repeat(200), raw_message: "Help!", simulated_user_verified: true },
  },
  {
    label: "lat out of range",
    body:  buildValidInput({ gps_coordinates: { lat: 999, lng: 103 } }),
  },
  {
    label: "empty image_base64",
    body:  buildValidInput({ image_base64: "short" }),
  },
  {
    label: "raw_message too short",
    body:  buildValidInput({ raw_message: "Hi" }),
  },
  {
    label: "simulated_user_verified not boolean",
    body:  { ...buildValidInput(), simulated_user_verified: "yes" },
  },
  {
    label: "unknown extra field (strict mode)",
    body:  { ...buildValidInput(), injected_field: "evil" },
  },
];
