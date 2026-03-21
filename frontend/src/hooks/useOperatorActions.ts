import { useCallback, useState } from 'react'
import { useSignalContext } from '@/context/SignalContext'
import {
  updateSignalStatus,
  extractErrorMessage,
} from '@/services/signalService'
import type { EnrichedSignal } from '@/types/signal.types'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — useOperatorActions
//
// Provides confirm and reject callbacks for SignalCard operator buttons.
//
// Both actions use an optimistic update pattern:
//   1. Dispatch UPDATE_STATUS immediately (UI feels instant)
//   2. Fire PATCH /api/v1/signals/:id/status
//   3. On success — nothing extra needed (state already updated)
//   4. On failure — roll back to the previous status and surface an error
//
// Returns per-signal loading and error state so each SignalCard can render
// its own spinner/error without coupling to siblings.
// ─────────────────────────────────────────────────────────────────────────────

interface OperatorActionsResult {
  /** Call when operator clicks "Confirm Dispatch" */
  confirmDispatch: (signal: EnrichedSignal) => Promise<void>
  /** Call when operator clicks "Reject" */
  rejectSignal:    (signal: EnrichedSignal) => Promise<void>
  /** True while a PATCH request is in-flight for the given signal id */
  isUpdating:      (id: string) => boolean
  /** Error message for the given signal id, or null */
  actionError:     (id: string) => string | null
  /** Clear the error for a given signal id */
  clearError:      (id: string) => void
}

export function useOperatorActions(): OperatorActionsResult {
  const { dispatch } = useSignalContext()

  // Track loading + error state per signal id
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [errors,   setErrors  ] = useState<Record<string, string>>({})

  const setLoadingFor  = (id: string, val: boolean) =>
    setUpdating(prev => ({ ...prev, [id]: val }))

  const setErrorFor    = (id: string, msg: string) =>
    setErrors(prev => ({ ...prev, [id]: msg }))

  const clearErrorFor  = useCallback((id: string) =>
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n }), [])

  const performUpdate = useCallback(async (
    signal:    EnrichedSignal,
    newStatus: 'Dispatched' | 'Rejected',
  ) => {
    const previousStatus = signal.status

    // 1. Optimistic update
    dispatch({ type: 'UPDATE_STATUS', payload: { id: signal.id, status: newStatus } })
    setLoadingFor(signal.id, true)
    clearErrorFor(signal.id)

    try {
      // 2. Confirm with backend
      await updateSignalStatus(signal.id, { status: newStatus })
      // Success — optimistic state is already correct, nothing more to do
    } catch (err) {
      // 3. Rollback on failure
      dispatch({
        type:    'UPDATE_STATUS',
        payload: { id: signal.id, status: previousStatus },
      })
      setErrorFor(signal.id, extractErrorMessage(err))
      console.error(`[useOperatorActions] Failed to update signal ${signal.id}:`, err)
    } finally {
      setLoadingFor(signal.id, false)
    }
  }, [dispatch, clearErrorFor])

  const confirmDispatch = useCallback(
    (signal: EnrichedSignal) => performUpdate(signal, 'Dispatched'),
    [performUpdate],
  )

  const rejectSignal = useCallback(
    (signal: EnrichedSignal) => performUpdate(signal, 'Rejected'),
    [performUpdate],
  )

  const isUpdating = useCallback(
    (id: string) => updating[id] ?? false,
    [updating],
  )

  const actionError = useCallback(
    (id: string) => errors[id] ?? null,
    [errors],
  )

  return { confirmDispatch, rejectSignal, isUpdating, actionError, clearError: clearErrorFor }
}