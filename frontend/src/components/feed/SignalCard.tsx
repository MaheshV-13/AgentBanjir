import { useRef, useEffect } from 'react'
import type { EnrichedSignal } from '@/types/signal.types'
import { getCardClasses } from '@/utils/severityStyles'
import SeverityBadge    from '@/components/signal/SeverityBadge'
import StatusBadge      from '@/components/signal/StatusBadge'
import ConfidenceBar    from '@/components/signal/ConfidenceBar'
import NeedsChipList    from '@/components/signal/NeedsChipList'
import CoordinatesTag   from '@/components/signal/CoordinatesTag'
import OperatorActions  from '@/components/signal/OperatorActions'

// ─────────────────────────────────────────────────────────────────────────────
// SignalCard — primary display unit for one EnrichedSignal
//
// Severity styling rules (SDD §7.1):
//   High       → Red border + animate-severity-pulse ring + role="alert"
//   Medium     → Amber border + static glow
//   Low        → Blue border, no animation
//   Dispatched → Green tint, pulse removed
//   Rejected   → opacity-40, pointer-events-none (Q5)
//
// isHighlighted: true when the corresponding map pin was clicked — adds a
// brand-colour focus ring and scrolls the card into view.
// ─────────────────────────────────────────────────────────────────────────────

interface SignalCardProps {
  signal:       EnrichedSignal
  onConfirm:    (signal: EnrichedSignal) => void
  onReject:     (signal: EnrichedSignal) => void
  isHighlighted?: boolean
  isUpdating?:  boolean
  actionError?: string | null
  onClearError?: () => void
}

export default function SignalCard({
  signal,
  onConfirm,
  onReject,
  isHighlighted  = false,
  isUpdating     = false,
  actionError    = null,
  onClearError   = () => {},
}: SignalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Auto-scroll highlighted card into view when selected via map pin
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHighlighted])

  const cardClasses = getCardClasses(signal.severity_level, signal.status, isHighlighted)

  // High severity active signals use role="alert" so screen readers announce them
  const isActiveHighAlert =
    signal.severity_level === 'High' && signal.status === 'Pending_Human_Review'

  return (
    <div
      ref={cardRef}
      className={cardClasses}
      role={isActiveHighAlert ? 'alert' : 'article'}
      aria-label={`Distress signal ${signal.id}, severity ${signal.severity_level}, status ${signal.status}`}
    >
      {/* ── Header row: badges + signal id ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={signal.severity_level} />
          <StatusBadge   status={signal.status} />
        </div>
        <span className="text-xs font-mono text-slate-500 shrink-0">
          #{signal.id.slice(-6).toUpperCase()}
        </span>
      </div>

      {/* ── Raw message ─────────────────────────────────────────────────── */}
      {signal.raw_message && (
        <p className="text-sm text-slate-300 mb-3 leading-snug line-clamp-2">
          {signal.raw_message}
        </p>
      )}

      {/* ── Confidence bar ──────────────────────────────────────────────── */}
      <div className="mb-3">
        <ConfidenceBar score={signal.ai_confidence_score} />
      </div>

      {/* ── Needs chips ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <NeedsChipList needs={signal.specific_needs} />
      </div>

      {/* ── Footer: coordinates + timestamp ────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <CoordinatesTag coords={signal.gps_coordinates} />
        {signal.created_at && (
          <span className="text-xs text-slate-500 font-mono shrink-0">
            {new Date(signal.created_at).toLocaleTimeString('en-MY', {
              hour:   '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        )}
      </div>

      {/* ── Operator actions ────────────────────────────────────────────── */}
      <OperatorActions
        signal={signal}
        onConfirm={onConfirm}
        onReject={onReject}
        isUpdating={isUpdating}
        actionError={actionError}
        onClearError={onClearError}
      />
    </div>
  )
}