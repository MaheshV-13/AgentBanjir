import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMapMarkers } from '@/hooks/useMapMarkers'
import { SignalProvider } from '@/context/SignalContext'
import { useSignalContext } from '@/context/SignalContext'
import { act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { EnrichedSignal } from '@/types/signal.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSignal = (overrides: Partial<EnrichedSignal>): EnrichedSignal => ({
  id:                  'sig-001',
  gps_coordinates:     { lat: 3.14, lng: 101.7 },
  severity_level:      'High',
  ai_confidence_score: 90,
  specific_needs:      ['rescue_boat'],
  status:              'Pending_Human_Review',
  raw_message:         'Help needed',
  ...overrides,
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <SignalProvider>{children}</SignalProvider>
)

// Hook that lets us load signals into context then read map markers
function useTestHarness() {
  const { dispatch } = useSignalContext()
  const mapData      = useMapMarkers()
  return { dispatch, ...mapData }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useMapMarkers', () => {
  it('returns empty markers when no signals', () => {
    const { result } = renderHook(() => useMapMarkers(), { wrapper })
    expect(result.current.markers).toHaveLength(0)
    expect(result.current.bounds).toBeNull()
    expect(result.current.hasActiveHighAlert).toBe(false)
  })

  it('excludes Rejected signals from markers', () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper })
    act(() => {
      result.current.dispatch({
        type: 'SET_SIGNALS',
        payload: [
          makeSignal({ id: 'a', status: 'Pending_Human_Review' }),
          makeSignal({ id: 'b', status: 'Rejected' }),
        ],
      })
    })
    expect(result.current.markers).toHaveLength(1)
    expect(result.current.markers[0].id).toBe('a')
  })

  it('uses green colour for Dispatched markers', () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper })
    act(() => {
      result.current.dispatch({
        type: 'SET_SIGNALS',
        payload: [makeSignal({ id: 'a', status: 'Dispatched', severity_level: 'High' })],
      })
    })
    expect(result.current.markers[0].colour).toBe('#3fb950')
  })

  it('sets isSelected on the selected marker', () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper })
    act(() => {
      result.current.dispatch({ type: 'SET_SIGNALS', payload: [makeSignal({ id: 'a' })] })
      result.current.dispatch({ type: 'SELECT_SIGNAL', payload: 'a' })
    })
    expect(result.current.markers[0].isSelected).toBe(true)
  })

  it('computes bounds from marker positions', () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper })
    act(() => {
      result.current.dispatch({
        type: 'SET_SIGNALS',
        payload: [
          makeSignal({ id: 'a', gps_coordinates: { lat: 3.0, lng: 101.0 } }),
          makeSignal({ id: 'b', gps_coordinates: { lat: 4.0, lng: 102.0 } }),
        ],
      })
    })
    expect(result.current.bounds).toEqual([[3.0, 101.0], [4.0, 102.0]])
  })

  it('hasActiveHighAlert is true when High+Pending signal exists', () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper })
    act(() => {
      result.current.dispatch({
        type: 'SET_SIGNALS',
        payload: [makeSignal({ severity_level: 'High', status: 'Pending_Human_Review' })],
      })
    })
    expect(result.current.hasActiveHighAlert).toBe(true)
  })

  it('hasActiveHighAlert is false when only Dispatched High signals', () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper })
    act(() => {
      result.current.dispatch({
        type: 'SET_SIGNALS',
        payload: [makeSignal({ severity_level: 'High', status: 'Dispatched' })],
      })
    })
    expect(result.current.hasActiveHighAlert).toBe(false)
  })

  it('selectedMarker is null when nothing selected', () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper })
    act(() => {
      result.current.dispatch({ type: 'SET_SIGNALS', payload: [makeSignal({ id: 'a' })] })
    })
    expect(result.current.selectedMarker).toBeNull()
  })
})