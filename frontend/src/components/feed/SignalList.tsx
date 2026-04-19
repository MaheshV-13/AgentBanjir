import { useSignalContext } from '@/context/SignalContext'
import { useOperatorActions } from '@/hooks/useOperatorActions'
import SignalCard from './SignalCard'

// ─────────────────────────────────────────────────────────────────────────────
// SignalList — renders the filtered signal list as a stack of SignalCards
//
// Consumes filteredSignals from context (already sorted + filtered).
// Wires useOperatorActions so each card gets per-signal loading/error state.
// Empty state is rendered when no signals match the active filter.
// ─────────────────────────────────────────────────────────────────────────────

export default function SignalList() {
  const { state }     = useSignalContext()
  const { filteredSignals, selectedSignalId } = state
  const { confirmDispatch, rejectSignal, isUpdating, actionError, clearError } =
    useOperatorActions()

  if (filteredSignals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500">
        <span className="text-3xl" aria-hidden="true">📭</span>
        <p className="text-sm">No signals match this filter</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2 p-3" aria-label="Distress signal feed">
      {filteredSignals.map((signal) => (
        <li key={signal.id}>
          <SignalCard
            signal={signal}
            isHighlighted={signal.id === selectedSignalId}
            isUpdating={isUpdating(signal.id)}
            actionError={actionError(signal.id)}
            onConfirm={confirmDispatch}
            onReject={rejectSignal}
            onClearError={() => clearError(signal.id)}
          />
        </li>
      ))}
    </ul>
  )
}