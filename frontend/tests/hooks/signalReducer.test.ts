import { describe, it, expect } from 'vitest'
import {
  signalReducer,
  initialState,
  sortSignals,
  applyFilter,
  type SignalState,
} from '@/context/signalReducer'
import type { EnrichedSignal } from '@/types/signal.types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeSignal = (overrides: Partial<EnrichedSignal>): EnrichedSignal => ({
  id:                  'sig-001',
  gps_coordinates:     { lat: 3.14, lng: 101.7 },
  severity_level:      'Medium',
  ai_confidence_score: 80,
  specific_needs:      [],
  status:              'Pending_Human_Review',
  created_at:          '2026-03-15T08:00:00+08:00',
  ...overrides,
})

const HIGH    = makeSignal({ id: 'h1', severity_level: 'High',   status: 'Pending_Human_Review' })
const MEDIUM  = makeSignal({ id: 'm1', severity_level: 'Medium', status: 'Pending_Human_Review' })
const LOW     = makeSignal({ id: 'l1', severity_level: 'Low',    status: 'Pending_Human_Review' })
const DISP    = makeSignal({ id: 'd1', severity_level: 'High',   status: 'Dispatched' })
const REJECT  = makeSignal({ id: 'r1', severity_level: 'Low',    status: 'Rejected' })

// ── sortSignals ───────────────────────────────────────────────────────────────

describe('sortSignals', () => {
  it('sorts High before Medium before Low', () => {
    const sorted = sortSignals([LOW, HIGH, MEDIUM])
    expect(sorted.map(s => s.id)).toEqual(['h1', 'm1', 'l1'])
  })

  it('sinks Rejected signals to the bottom', () => {
    const sorted = sortSignals([REJECT, HIGH, LOW])
    expect(sorted[sorted.length - 1].id).toBe('r1')
  })

  it('sorts newer signals first within same severity', () => {
    const older = makeSignal({ id: 'old', severity_level: 'High', created_at: '2026-03-15T06:00:00+08:00' })
    const newer = makeSignal({ id: 'new', severity_level: 'High', created_at: '2026-03-15T09:00:00+08:00' })
    const sorted = sortSignals([older, newer])
    expect(sorted[0].id).toBe('new')
  })
})

// ── applyFilter ───────────────────────────────────────────────────────────────

describe('applyFilter', () => {
  const all = [HIGH, MEDIUM, LOW, DISP, REJECT]

  it('All returns all signals including Rejected', () => {
    expect(applyFilter(all, 'All')).toHaveLength(5)
  })

  it('High returns only High severity', () => {
    const result = applyFilter(all, 'High')
    expect(result.every(s => s.severity_level === 'High')).toBe(true)
  })

  it('Pending returns only Pending_Human_Review', () => {
    const result = applyFilter(all, 'Pending')
    expect(result.every(s => s.status === 'Pending_Human_Review')).toBe(true)
  })

  it('Dispatched returns only Dispatched', () => {
    const result = applyFilter(all, 'Dispatched')
    expect(result.every(s => s.status === 'Dispatched')).toBe(true)
  })
})

// ── signalReducer ─────────────────────────────────────────────────────────────

describe('signalReducer — SET_SIGNALS', () => {
  it('replaces signal list and applies current filter', () => {
    const state = signalReducer(initialState, { type: 'SET_SIGNALS', payload: [HIGH, LOW] })
    expect(state.signals).toHaveLength(2)
    expect(state.filteredSignals).toHaveLength(2)
  })

  it('clears pollError on successful SET_SIGNALS', () => {
    const errorState: SignalState = { ...initialState, pollError: 'network error' }
    const state = signalReducer(errorState, { type: 'SET_SIGNALS', payload: [] })
    expect(state.pollError).toBeNull()
  })

  it('sorts signals by severity', () => {
    const state = signalReducer(initialState, { type: 'SET_SIGNALS', payload: [LOW, HIGH, MEDIUM] })
    expect(state.signals[0].severity_level).toBe('High')
  })
})

describe('signalReducer — UPSERT_SIGNAL', () => {
  it('prepends a new signal', () => {
    const state = signalReducer(
      { ...initialState, signals: [MEDIUM] },
      { type: 'UPSERT_SIGNAL', payload: HIGH },
    )
    expect(state.signals).toHaveLength(2)
  })

  it('updates an existing signal by id', () => {
    const updated = { ...HIGH, ai_confidence_score: 99 }
    const base    = { ...initialState, signals: [HIGH, LOW] }
    const state   = signalReducer(base, { type: 'UPSERT_SIGNAL', payload: updated })
    const found   = state.signals.find(s => s.id === 'h1')
    expect(found?.ai_confidence_score).toBe(99)
    expect(state.signals).toHaveLength(2)
  })
})

describe('signalReducer — UPDATE_STATUS', () => {
  it('mutates status of the target signal only', () => {
    const base  = { ...initialState, signals: [HIGH, LOW] }
    const state = signalReducer(base, {
      type:    'UPDATE_STATUS',
      payload: { id: 'h1', status: 'Dispatched' },
    })
    const updated = state.signals.find(s => s.id === 'h1')
    const other   = state.signals.find(s => s.id === 'l1')
    expect(updated?.status).toBe('Dispatched')
    expect(other?.status).toBe('Pending_Human_Review')
  })
})

describe('signalReducer — SET_FILTER', () => {
  it('updates activeFilter and recomputes filteredSignals', () => {
    const base  = { ...initialState, signals: [HIGH, LOW] }
    const state = signalReducer(base, { type: 'SET_FILTER', payload: 'High' })
    expect(state.activeFilter).toBe('High')
    expect(state.filteredSignals.every(s => s.severity_level === 'High')).toBe(true)
  })
})

describe('signalReducer — SELECT_SIGNAL', () => {
  it('sets selectedSignalId', () => {
    const state = signalReducer(initialState, { type: 'SELECT_SIGNAL', payload: 'h1' })
    expect(state.selectedSignalId).toBe('h1')
  })

  it('clears selectedSignalId with null', () => {
    const base  = { ...initialState, selectedSignalId: 'h1' }
    const state = signalReducer(base, { type: 'SELECT_SIGNAL', payload: null })
    expect(state.selectedSignalId).toBeNull()
  })
})

describe('signalReducer — SET_POLLING / SET_LAST_SYNCED / SET_POLL_ERROR', () => {
  it('toggles isPolling', () => {
    const on  = signalReducer(initialState, { type: 'SET_POLLING', payload: true })
    const off = signalReducer(on, { type: 'SET_POLLING', payload: false })
    expect(on.isPolling).toBe(true)
    expect(off.isPolling).toBe(false)
  })

  it('sets lastSyncedAt and clears pollError', () => {
    const base  = { ...initialState, pollError: 'previous error' }
    const now   = new Date()
    const state = signalReducer(base, { type: 'SET_LAST_SYNCED', payload: now })
    expect(state.lastSyncedAt).toBe(now)
    expect(state.pollError).toBeNull()
  })

  it('sets and clears pollError', () => {
    const errState = signalReducer(initialState, { type: 'SET_POLL_ERROR', payload: 'timeout' })
    expect(errState.pollError).toBe('timeout')
    const cleared  = signalReducer(errState, { type: 'SET_POLL_ERROR', payload: null })
    expect(cleared.pollError).toBeNull()
  })
})