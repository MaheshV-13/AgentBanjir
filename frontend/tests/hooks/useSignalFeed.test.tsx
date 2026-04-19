import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSignalFeed } from '@/hooks/useSignalFeed'
import * as signalService from '@/services/signalService'
import { SignalProvider } from '@/context/SignalContext'
import type { ReactNode } from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/signalService', () => ({
  fetchSignals:        vi.fn(),
  extractErrorMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'error')),
}))

const mockFetchSignals = vi.mocked(signalService.fetchSignals)

const VALID_SIGNAL = {
  id:                  'sig-001',
  gps_coordinates:     { lat: 3.14, lng: 101.7 },
  severity_level:      'High' as const,
  ai_confidence_score: 90,
  specific_needs:      [],
  status:              'Pending_Human_Review' as const,
  created_at:          '2026-03-15T08:00:00+08:00',
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SignalProvider>{children}</SignalProvider>
)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSignalFeed', () => {
  beforeEach(() => {
    // Only fake interval timers so RTL's waitFor (setTimeout) can still operate
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches signals immediately on mount', async () => {
    mockFetchSignals.mockResolvedValueOnce([VALID_SIGNAL])
    renderHook(() => useSignalFeed(), { wrapper })
    await waitFor(() => expect(mockFetchSignals).toHaveBeenCalledTimes(1))
  })

  it('polls again after the interval', async () => {
    mockFetchSignals.mockResolvedValue([VALID_SIGNAL])
    renderHook(() => useSignalFeed(), { wrapper })

    await waitFor(() => expect(mockFetchSignals).toHaveBeenCalledTimes(1))

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    await waitFor(() => expect(mockFetchSignals).toHaveBeenCalledTimes(2))
  })

  it('does not crash when fetch returns empty array', async () => {
    mockFetchSignals.mockResolvedValueOnce([])
    renderHook(() => useSignalFeed(), { wrapper })
    await waitFor(() => expect(mockFetchSignals).toHaveBeenCalledTimes(1))
  })

  it('handles fetch failure without crashing', async () => {
    mockFetchSignals.mockRejectedValueOnce(new Error('Network error'))
    renderHook(() => useSignalFeed(), { wrapper })
    await waitFor(() => expect(mockFetchSignals).toHaveBeenCalledTimes(1))
  })

  it('clears interval on unmount', async () => {
    mockFetchSignals.mockResolvedValue([])
    // Spy on window instead of globalThis for JSDOM stability
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const { unmount } = renderHook(() => useSignalFeed(), { wrapper })
    await waitFor(() => expect(mockFetchSignals).toHaveBeenCalledTimes(1))
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})