import { useEffect, useRef, useCallback } from 'react'
import { useSignalContext } from '@/context/SignalContext'
import { fetchSignals, extractErrorMessage } from '@/services/signalService'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — useSignalFeed
//
// Polls GET /api/v1/signals on mount and every VITE_POLL_INTERVAL_MS ms.
// Dispatches into SignalContext — no local state is returned.
//
// Features:
//   • Immediate fetch on mount (no waiting for first interval)
//   • Configurable interval via VITE_POLL_INTERVAL_MS env var (default 5s)
//   • Up to 3 consecutive retry attempts before marking poll error
//   • clearInterval on unmount — no stale closures or memory leaks
//   • In-flight request guard — skips a tick if the previous fetch is still
//     running (prevents race conditions on slow networks)
//
// WebSocket upgrade path (production):
//   Replace the setInterval block with a WebSocket listener.
//   All dispatch calls remain identical — components are unaffected.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS) || 5_000
const MAX_RETRIES      = 3

export function useSignalFeed(): void {
  const { dispatch }      = useSignalContext()
  const isFetchingRef     = useRef(false)
  const consecutiveErrors = useRef(0)
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    // Skip if a previous fetch is still in-flight
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const signals = await fetchSignals()

      // Reset error counter on success
      consecutiveErrors.current = 0

      dispatch({ type: 'SET_SIGNALS',     payload: signals })
      dispatch({ type: 'SET_LAST_SYNCED', payload: new Date() })
      dispatch({ type: 'SET_POLLING',     payload: true })
      dispatch({ type: 'SET_POLL_ERROR',  payload: null })

    } catch (err) {
      consecutiveErrors.current += 1
      const message = extractErrorMessage(err)

      console.warn(
        `[useSignalFeed] Poll failed (attempt ${consecutiveErrors.current}/${MAX_RETRIES}):`,
        message,
      )

      if (consecutiveErrors.current >= MAX_RETRIES) {
        // After 3 consecutive failures, surface the error to the UI
        dispatch({ type: 'SET_POLLING',    payload: false })
        dispatch({ type: 'SET_POLL_ERROR', payload: message })
      }
    } finally {
      isFetchingRef.current = false
    }
  }, [dispatch])

  useEffect(() => {
    // Mark polling as started
    dispatch({ type: 'SET_POLLING', payload: true })

    // Fetch immediately on mount — don't wait for the first interval tick
    poll()

    // Then poll on the configured interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      // Clean up on unmount — prevent state updates on unmounted component
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
      dispatch({ type: 'SET_POLLING', payload: false })
    }
  }, [poll, dispatch])
}