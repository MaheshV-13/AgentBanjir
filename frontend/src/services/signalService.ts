import type { AxiosError } from 'axios'
import apiClient from './apiClient'
import type { EnrichedSignal, MasterInputSignal, StatusUpdatePayload } from '@/types/signal.types'
import {
  parseSignalListResponse,
  parseEnrichedSignal,
  AnalyseSignalResponseSchema,
} from '@/schemas/signalSchemas'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — Signal Service
//
// All API calls related to distress signals live here.
// Every function:
//   1. Makes the HTTP request via apiClient
//   2. Validates the response with the matching Zod schema
//   3. Returns typed data or throws a descriptive Error
//
// Consumers (hooks, components) should catch errors and handle UI feedback.
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/v1/signals ───────────────────────────────────────────────────────

/**
 * Fetches the full list of enriched distress signals from the backend.
 * Called on mount and every VITE_POLL_INTERVAL_MS milliseconds by useSignalFeed.
 *
 * Handles both response shapes from Member 2's backend:
 *   { signals: [...] }  or  [...]
 *
 * @returns Validated array of EnrichedSignal objects (empty array on parse failure)
 * @throws Error if the HTTP request itself fails (network / 5xx)
 */
export async function fetchSignals(): Promise<EnrichedSignal[]> {
  const response = await apiClient.get('/api/v1/signals')

  const parsed = parseSignalListResponse(response.data)

  if (!parsed.success) {
    // Schema mismatch — log and return empty rather than crashing the feed
    console.warn('[signalService] fetchSignals: response failed Zod validation, returning []')
    return parsed.fallback.signals
  }

  return parsed.data.signals
}

// ── POST /api/v1/analyze-signal ───────────────────────────────────────────────

/**
 * Submits a new distress signal from the mock victim submission form.
 * The backend processes it through Gemini and returns an enriched signal
 * immediately — we upsert that directly into the feed.
 *
 * @param payload  Validated MasterInputSignal from the submission form
 * @returns        The freshly enriched signal returned by the backend
 * @throws         Error if the request fails or response fails validation
 */
export async function submitSignal(payload: MasterInputSignal): Promise<EnrichedSignal> {
  const response = await apiClient.post('/api/v1/analyze-signal', payload)

  const parsed = AnalyseSignalResponseSchema.safeParse(response.data)

  if (!parsed.success) {
    console.error('[signalService] submitSignal: response failed Zod validation', parsed.error.flatten())
    throw new Error('Received an unexpected response format from the server.')
  }

  return parsed.data
}

// ── PATCH /api/v1/signals/:id/status ─────────────────────────────────────────

/**
 * Updates the status of a signal — either "Dispatched" or "Rejected".
 * The UI applies an optimistic update before calling this; on failure the
 * caller is responsible for rolling back via UPDATE_STATUS reducer action.
 *
 * Confirmed API endpoint (Q1): PATCH /api/v1/signals/:id/status
 *
 * @param id      Signal id to update
 * @param payload { status: 'Dispatched' | 'Rejected' }
 * @returns       The updated signal as confirmed by the backend
 * @throws        Error if the request fails or response fails validation
 */
export async function updateSignalStatus(
  id: string,
  payload: StatusUpdatePayload,
): Promise<EnrichedSignal> {
  const response = await apiClient.patch(`/api/v1/signals/${id}/status`, payload)

  const parsed = parseEnrichedSignal(response.data)

  if (!parsed.success) {
    console.error('[signalService] updateSignalStatus: response failed Zod validation', parsed.error.flatten())
    throw new Error(`Status update for signal ${id} returned an unexpected format.`)
  }

  return parsed.data
}

// ── Error helpers ─────────────────────────────────────────────────────────────

/**
 * Extracts a human-readable message from an unknown caught error.
 * Use this in hooks/components to populate toast notifications.
 *
 * @example
 *   try { await fetchSignals() }
 *   catch (err) { showToast(extractErrorMessage(err)) }
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred.'
}

/**
 * Returns true if the error is an Axios network error (no response received).
 * Useful for showing a "connection lost" indicator in the feed header.
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'isAxiosError' in error &&
    (error as AxiosError).response === undefined
  )
}