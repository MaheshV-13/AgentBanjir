// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — Shared TypeScript types
// Mirrors the API contract (SDD §13.1) agreed with Member 1 + 2.
// DO NOT change these unilaterally — any change requires cross-team sign-off.
//
// Runtime Zod schemas live in: src/schemas/signalSchemas.ts
// Every interface here has a corresponding z.infer<> type in that file.
// Prefer the Zod-inferred types inside services/ and hooks/ where validation
// has already occurred. Use these hand-written interfaces in components/ for
// explicit JSDoc and prop-type documentation.
// ─────────────────────────────────────────────────────────────────────────────

// ── Severity & Status enums ──────────────────────────────────────────────────

export type SeverityLevel = 'Low' | 'Medium' | 'High'

export type SignalStatus =
  | 'Pending_Human_Review'
  | 'Dispatched'
  | 'Rejected'

export type FilterOption = 'All' | 'High' | 'Pending' | 'Dispatched'

// ── GPS ──────────────────────────────────────────────────────────────────────

export interface GpsCoordinates {
  lat: number
  lng: number
}

// ── Master Input JSON Schema (POST /api/v1/analyze-signal) ───────────────────
// Submitted by the victim-side form (or mock demo form).

export interface MasterInputSignal {
  gps_coordinates: GpsCoordinates
  /** Base64 data-URI string, or empty string if no image attached */
  image_base64: string
  /** Raw distress message from victim, 1–500 chars */
  raw_message: string
  simulated_user_verified: boolean
}

export interface NearestBoat {
  boat_id: string;
  name: string;
  distance_km: number;
  capacity: number;
  current_status: 'Available' | 'Deployed' | 'Maintenance';
}

// ── Enriched JSON Schema (GET /api/v1/signals response items) ────────────────
// Produced by Member 2's Genkit Orchestrator. Frontend treats this as read-only
// except for the `status` field (mutated via PATCH /api/v1/signals/:id/status).

export interface EnrichedSignal {
  id: string
  gps_coordinates: GpsCoordinates
  severity_level: SeverityLevel
  /** AI triage confidence, 0–100 (integer; floats normalised by Zod schema) */
  ai_confidence_score: number
  specific_needs: string[]
  status: SignalStatus
  /** ISO-8601 timestamp — set by backend; used for feed sort order */
  created_at?: string
  /** ISO-8601 timestamp of the most recent status mutation (e.g. dispatched time) */
  updated_at?: string
  /** Original raw message from victim — displayed in SignalCard detail row */
  raw_message?: string
  nearest_boats?: NearestBoat[];
}

// ── Operator status update (PATCH /api/v1/signals/:id/status) ────────────────

export interface StatusUpdatePayload {
  status: 'Dispatched' | 'Rejected'
}

// ── GET /api/v1/signals response wrapper ─────────────────────────────────────
// The Zod schema handles both { signals: [...] } and bare [...] shapes.
// This interface documents the normalised shape after validation.

export interface SignalListResponse {
  signals: EnrichedSignal[]
}