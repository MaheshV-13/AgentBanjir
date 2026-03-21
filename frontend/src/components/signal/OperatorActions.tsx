import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { EnrichedSignal } from '@/types/signal.types'

// ─────────────────────────────────────────────────────────────────────────────
// OperatorActions — Confirm Dispatch / Reject buttons for SignalCard
//
// Buttons are hidden for Dispatched and Rejected signals (action already taken).
// Loading spinner replaces the button content while the PATCH is in-flight.
// Error message is shown inline below the buttons on failure.
//
// WCAG 4.1.2: icon-only buttons have aria-label.
// WCAG 2.1.1: fully keyboard accessible via focus-visible ring.
// ─────────────────────────────────────────────────────────────────────────────

interface OperatorActionsProps {
  signal:          EnrichedSignal
  onConfirm:       (signal: EnrichedSignal) => void
  onReject:        (signal: EnrichedSignal) => void
  isUpdating:      boolean
  actionError:     string | null
  onClearError:    () => void
}

export default function OperatorActions({
  signal,
  onConfirm,
  onReject,
  isUpdating,
  actionError,
  onClearError,
}: OperatorActionsProps) {
  const isDone = signal.status === 'Dispatched' || signal.status === 'Rejected'

  // Hide actions once a terminal status is reached
  if (isDone) return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* Confirm Dispatch */}
        <button
          onClick={() => { onClearError(); onConfirm(signal) }}
          disabled={isUpdating}
          aria-label="Confirm dispatch"
          className="
            flex-1 flex items-center justify-center gap-1.5
            px-3 py-1.5 rounded-md text-xs font-medium
            bg-green-700/20 text-green-400
            border border-green-700/40
            hover:bg-green-700/35 hover:border-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-green-500 focus-visible:ring-offset-1
            focus-visible:ring-offset-[#0d1117]
          "
        >
          {isUpdating ? (
            <Loader2
              aria-hidden="true"
              style={{ width: 13, height: 13 }}
              className="animate-spin"
            />
          ) : (
            <CheckCircle aria-hidden="true" style={{ width: 13, height: 13 }} />
          )}
          Confirm Dispatch
        </button>

        {/* Reject */}
        <button
          onClick={() => { onClearError(); onReject(signal) }}
          disabled={isUpdating}
          aria-label="Reject signal"
          className="
            flex items-center justify-center gap-1.5
            px-3 py-1.5 rounded-md text-xs font-medium
            bg-slate-700/20 text-slate-400
            border border-slate-600/40
            hover:bg-red-900/20 hover:text-red-400 hover:border-red-800/50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-red-500 focus-visible:ring-offset-1
            focus-visible:ring-offset-[#0d1117]
          "
        >
          {isUpdating ? (
            <Loader2
              aria-hidden="true"
              style={{ width: 13, height: 13 }}
              className="animate-spin"
            />
          ) : (
            <XCircle aria-hidden="true" style={{ width: 13, height: 13 }} />
          )}
          Reject
        </button>
      </div>

      {/* Inline error message on PATCH failure */}
      {actionError && (
        <p
          role="alert"
          className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded px-2 py-1"
        >
          {actionError}
        </p>
      )}
    </div>
  )
}