import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOperatorActions } from '@/hooks/useOperatorActions'
import * as signalService from '@/services/signalService'
import { SignalProvider } from '@/context/SignalContext'
import type { ReactNode } from 'react'
import type { EnrichedSignal } from '@/types/signal.types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/signalService', () => ({
  updateSignalStatus:  vi.fn(),
  extractErrorMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'Unknown error')),
}))

const mockUpdateStatus = vi.mocked(signalService.updateSignalStatus)

const SIGNAL: EnrichedSignal = {
  id:                  'sig-001',
  gps_coordinates:     { lat: 3.14, lng: 101.7 },
  severity_level:      'High',
  ai_confidence_score: 90,
  specific_needs:      [],
  status:              'Pending_Human_Review',
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SignalProvider>{children}</SignalProvider>
)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useOperatorActions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('isUpdating is false initially', () => {
    const { result } = renderHook(() => useOperatorActions(), { wrapper })
    expect(result.current.isUpdating('sig-001')).toBe(false)
  })

  it('actionError is null initially', () => {
    const { result } = renderHook(() => useOperatorActions(), { wrapper })
    expect(result.current.actionError('sig-001')).toBeNull()
  })

  it('sets isUpdating to true during confirmDispatch', async () => {
    let resolveFn!: (v: EnrichedSignal) => void
    mockUpdateStatus.mockImplementationOnce(
      () => new Promise<EnrichedSignal>(res => { resolveFn = res }),
    )

    const { result } = renderHook(() => useOperatorActions(), { wrapper })

    act(() => { result.current.confirmDispatch(SIGNAL) })
    expect(result.current.isUpdating('sig-001')).toBe(true)

    act(() => resolveFn({ ...SIGNAL, status: 'Dispatched' }))
    await waitFor(() => expect(result.current.isUpdating('sig-001')).toBe(false))
  })

  it('clears isUpdating after successful confirmDispatch', async () => {
    mockUpdateStatus.mockResolvedValueOnce({ ...SIGNAL, status: 'Dispatched' })
    const { result } = renderHook(() => useOperatorActions(), { wrapper })
    await act(() => result.current.confirmDispatch(SIGNAL))
    expect(result.current.isUpdating('sig-001')).toBe(false)
  })

  it('sets actionError when confirmDispatch fails', async () => {
    mockUpdateStatus.mockRejectedValueOnce(new Error('Server unavailable'))
    const { result } = renderHook(() => useOperatorActions(), { wrapper })
    await act(() => result.current.confirmDispatch(SIGNAL))
    await waitFor(() => expect(result.current.actionError('sig-001')).toBe('Server unavailable'))
  })

  it('clears error when clearError is called', async () => {
    mockUpdateStatus.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useOperatorActions(), { wrapper })
    await act(() => result.current.confirmDispatch(SIGNAL))
    await waitFor(() => expect(result.current.actionError('sig-001')).not.toBeNull())
    act(() => result.current.clearError('sig-001'))
    expect(result.current.actionError('sig-001')).toBeNull()
  })

  it('calls updateSignalStatus with Rejected for rejectSignal', async () => {
    mockUpdateStatus.mockResolvedValueOnce({ ...SIGNAL, status: 'Rejected' })
    const { result } = renderHook(() => useOperatorActions(), { wrapper })
    await act(() => result.current.rejectSignal(SIGNAL))
    expect(mockUpdateStatus).toHaveBeenCalledWith('sig-001', { status: 'Rejected' })
  })
})