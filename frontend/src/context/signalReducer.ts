import type { EnrichedSignal, FilterOption } from '@/types/signal.types'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — Signal Reducer + Action Types
//
// Extracted from SignalContext so it can be unit-tested in isolation.
// Import action types from here wherever dispatch calls are made.
// ─────────────────────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────

export interface SignalState {
  /** Full unfiltered list — source of truth from API */
  signals:          EnrichedSignal[]
  /** Derived: signals after activeFilter is applied */
  filteredSignals:  EnrichedSignal[]
  /** Currently active feed filter tab */
  activeFilter:     FilterOption
  /** Signal highlighted via map pin click */
  selectedSignalId: string | null
  /** Whether the polling loop is currently running */
  isPolling:        boolean
  /** Timestamp of the last successful GET /api/v1/signals */
  lastSyncedAt:     Date | null
  /** Non-null when the last poll failed */
  pollError:        string | null
}

export const initialState: SignalState = {
  signals:          [],
  filteredSignals:  [],
  activeFilter:     'All',
  selectedSignalId: null,
  isPolling:        false,
  lastSyncedAt:     null,
  pollError:        null,
}

// ── Action types ──────────────────────────────────────────────────────────────

export type SignalAction =
  /** Replace the entire signal list (e.g. first load) */
  | { type: 'SET_SIGNALS';     payload: EnrichedSignal[] }
  /** Add a new signal or update an existing one by id */
  | { type: 'UPSERT_SIGNAL';   payload: EnrichedSignal }
  /** Mutate the status field of one signal (optimistic update + confirm) */
  | { type: 'UPDATE_STATUS';   payload: { id: string; status: EnrichedSignal['status'] } }
  /** Switch the active feed filter tab */
  | { type: 'SET_FILTER';      payload: FilterOption }
  /** Highlight a signal across the map and feed (null = deselect) */
  | { type: 'SELECT_SIGNAL';   payload: string | null }
  /** Toggle the live indicator in AppHeader */
  | { type: 'SET_POLLING';     payload: boolean }
  /** Record the timestamp of a successful poll */
  | { type: 'SET_LAST_SYNCED'; payload: Date }
  /** Record a poll error message (null = clear error) */
  | { type: 'SET_POLL_ERROR';  payload: string | null }

// ── Sort helpers ──────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<EnrichedSignal['severity_level'], number> = {
  High:   0,
  Medium: 1,
  Low:    2,
}

/**
 * Sort signals: High → Medium → Low, then newest first within same severity.
 * Rejected signals sink to the bottom (Q5: kept in feed but visually dimmed).
 */
export function sortSignals(signals: EnrichedSignal[]): EnrichedSignal[] {
  return [...signals].sort((a, b) => {
    // Rejected always last
    const aRejected = a.status === 'Rejected' ? 1 : 0
    const bRejected = b.status === 'Rejected' ? 1 : 0
    if (aRejected !== bRejected) return aRejected - bRejected

    // Sort by severity
    const severityDiff = SEVERITY_ORDER[a.severity_level] - SEVERITY_ORDER[b.severity_level]
    if (severityDiff !== 0) return severityDiff

    // Within same severity, newest first
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })
}

// ── Filter helper ─────────────────────────────────────────────────────────────

export function applyFilter(
  signals: EnrichedSignal[],
  filter:  FilterOption,
): EnrichedSignal[] {
  switch (filter) {
    case 'High':       return signals.filter(s => s.severity_level === 'High')
    case 'Pending':    return signals.filter(s => s.status === 'Pending_Human_Review')
    case 'Dispatched': return signals.filter(s => s.status === 'Dispatched')
    default:           return signals   // 'All' — includes Rejected (dimmed in UI)
  }
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function signalReducer(
  state:  SignalState,
  action: SignalAction,
): SignalState {
  switch (action.type) {

    case 'SET_SIGNALS': {
      const signals = sortSignals(action.payload)
      return {
        ...state,
        signals,
        filteredSignals: applyFilter(signals, state.activeFilter),
        pollError: null,
      }
    }

    case 'UPSERT_SIGNAL': {
      const exists  = state.signals.some(s => s.id === action.payload.id)
      const raw     = exists
        ? state.signals.map(s => s.id === action.payload.id ? action.payload : s)
        : [action.payload, ...state.signals]
      const signals = sortSignals(raw)
      return {
        ...state,
        signals,
        filteredSignals: applyFilter(signals, state.activeFilter),
      }
    }

    case 'UPDATE_STATUS': {
      const signals = sortSignals(
        state.signals.map(s =>
          s.id === action.payload.id
            ? { ...s, status: action.payload.status }
            : s,
        ),
      )
      return {
        ...state,
        signals,
        filteredSignals: applyFilter(signals, state.activeFilter),
      }
    }

    case 'SET_FILTER': {
      return {
        ...state,
        activeFilter:    action.payload,
        filteredSignals: applyFilter(state.signals, action.payload),
      }
    }

    case 'SELECT_SIGNAL':
      return { ...state, selectedSignalId: action.payload }

    case 'SET_POLLING':
      return { ...state, isPolling: action.payload }

    case 'SET_LAST_SYNCED':
      return { ...state, lastSyncedAt: action.payload, pollError: null }

    case 'SET_POLL_ERROR':
      return { ...state, pollError: action.payload }

    default:
      return state
  }
}