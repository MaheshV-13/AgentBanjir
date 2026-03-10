/**
 * @module types/signal.types
 *
 * Shared TypeScript interfaces for the AgentBanjir signal lifecycle.
 *
 * This is the CANONICAL type contract for all four members. Any change here
 * is a breaking change and must be coordinated via the Cross-Team Integration
 * Registry (SDD §16). Do not modify without team-lead sign-off.
 */

// ─── Severity & Status Enums ──────────────────────────────────────────────────

/** Triage severity level assigned by Gemini 2.0 extraction (Member 1). */
export type SeverityLevel = "Low" | "Medium" | "High";

/**
 * Operator-controlled lifecycle status of a processed signal.
 * Defaults to "Pending_Human_Review" upon creation.
 */
export type SignalStatus =
  | "Pending_Human_Review"
  | "Dispatched"
  | "Rejected";

// ─── GPS Coordinates ─────────────────────────────────────────────────────────

/** WGS-84 GPS coordinate pair. Both fields are required for routing decisions. */
export interface GpsCoordinates {
  readonly lat: number;
  readonly lng: number;
}

// ─── Master Input Signal ─────────────────────────────────────────────────────

/**
 * Raw distress signal submitted by the client (Member 3's dashboard or API consumer).
 * Validated against MasterInputSchema (Zod) at the gateway layer before any
 * upstream AI calls are made.
 */
export interface MasterInputSignal {
  /** WGS-84 GPS coordinates of the incident. */
  readonly gps_coordinates:         GpsCoordinates;
  /**
   * Base64-encoded image of the flood scene.
   * Passed to Gemini 2.0 multimodal input (Member 1).
   * NEVER logged — PII/privacy risk.
   */
  readonly image_base64:            string;
  /**
   * Raw text message from the distressed citizen.
   * May contain BM or EN. Passed to Gemini for text extraction.
   * NEVER logged — PII/privacy risk.
   */
  readonly raw_message:             string;
  /**
   * Indicates whether the submitting user has completed identity verification.
   * Used to weight AI confidence scoring; not used for rate limiting (per-IP is used).
   */
  readonly simulated_user_verified: boolean;
}

// ─── Enriched Signal ─────────────────────────────────────────────────────────

/**
 * Fully-processed signal returned by the POST /api/v1/analyze-signal endpoint
 * and persisted in the in-memory signal store. Combines:
 *   - Gateway-assigned metadata (id, status, timestamps)
 *   - Member 1 extraction results (severity, confidence, needs, nearest boats)
 *   - Member 2 flow results (dispatch actions, tool receipts)
 */
export interface EnrichedSignal {
  /** UUID assigned by the gateway via crypto.randomUUID(). Immutable. */
  readonly id: string;

  /** Original GPS coordinates passed through from the input signal. */
  readonly gps_coordinates: GpsCoordinates;

  /** Triage severity level determined by Gemini 2.0. */
  severity_level: SeverityLevel;

  /**
   * AI confidence score (0–100) for the severity classification.
   * A score below a configurable threshold triggers a "warn" log.
   */
  ai_confidence_score: number;

  /** List of specific resource needs identified (e.g., "life_jacket", "medical"). */
  specific_needs: string[];

  /**
   * Current operator-controlled status of the signal.
   * Mutated by PATCH /api/v1/signals/:id/status.
   */
  status: SignalStatus;

  /** ISO 8601 timestamp of when the signal was first received and processed. */
  readonly created_at: string;

  /** ISO 8601 timestamp of the most recent status mutation. */
  updated_at: string;

  /**
   * Contextual data from Vertex AI Search RAG (Member 1).
   * Nearest available rescue boats returned from the grounded query.
   * Optional — absent if RAG call fails (degraded mode).
   */
  nearest_boats?: NearestBoat[];

  /**
   * Receipt from Member 2's Genkit flow execution.
   * Captures which tools were invoked (SMS, DB log) and their outcomes.
   */
  flow_result?: FlowResult;
}

// ─── Nearest Boat (RAG Context) ───────────────────────────────────────────────

/** Rescue boat context returned from Vertex AI Search (Member 1's RAG layer). */
export interface NearestBoat {
  readonly boat_id:       string;
  readonly name:          string;
  readonly distance_km:   number;
  readonly capacity:      number;
  readonly current_status: "Available" | "Deployed" | "Maintenance";
}

// ─── Genkit Flow Result ───────────────────────────────────────────────────────

/** Result envelope returned by Member 2's floodCrisisOrchestrationFlow. */
export interface FlowResult {
  /** Final status recommendation from the Genkit flow decision. */
  readonly recommended_status: SignalStatus;
  /** Audit trail of tools invoked during flow execution. */
  readonly actions_taken:      FlowAction[];
}

export interface FlowAction {
  readonly tool:    string;   // e.g. "sms_dispatch_tool", "db_log_tool"
  readonly success: boolean;
  readonly details: string;   // Safe summary; no PII
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

/** Standard success envelope wrapping GET /api/v1/signals response. */
export interface SignalsListResponse {
  readonly signals:   EnrichedSignal[];
  readonly total:     number;
  readonly synced_at: string;
}

/** Standard error envelope — normalised by globalErrorHandler. */
export interface ApiErrorResponse {
  readonly error: {
    readonly code:       string;
    readonly message:    string;
    readonly request_id: string;
    readonly timestamp:  string;
    /** Field-level validation errors; present only for VALIDATION_ERROR codes. */
    readonly details?:   unknown;
  };
}

/** Health check response shape — consumed by Cloud Run liveness probes. */
export interface HealthCheckResponse {
  readonly status:    "ok";
  readonly uptime:    number;
  readonly timestamp: string;
}
