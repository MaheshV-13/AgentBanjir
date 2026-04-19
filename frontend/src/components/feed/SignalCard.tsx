import { useRef, useEffect } from 'react'
import type { EnrichedSignal } from '@/types/signal.types'
import { getCardClasses } from '@/utils/severityStyles'
import SeverityBadge from '@/components/signal/SeverityBadge'
import StatusBadge from '@/components/signal/StatusBadge'
import ConfidenceBar from '@/components/signal/ConfidenceBar'
import NeedsChipList from '@/components/signal/NeedsChipList'
import CoordinatesTag from '@/components/signal/CoordinatesTag'
import OperatorActions from '@/components/signal/OperatorActions'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

// Icon components for the Asset card
const BoatIcon = () => (
  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

interface SignalCardProps {
  signal: EnrichedSignal
  onConfirm: (signal: EnrichedSignal) => void
  onReject: (signal: EnrichedSignal) => void
  isHighlighted?: boolean
  isUpdating?: boolean
  actionError?: string | null
  onClearError?: () => void
}

export default function SignalCard({
  signal,
  onConfirm,
  onReject,
  isHighlighted = false,
  isUpdating = false,
  actionError = null,
  onClearError = () => { },
}: SignalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHighlighted])

  const cardClasses = getCardClasses(signal.severity_level, signal.status, isHighlighted)
  const isActiveHighAlert = signal.severity_level === 'High' && signal.status === 'Pending_Human_Review'

  // PHASE 5: Extract the recommended asset (nearest boat)
  const recommendedBoat = signal.nearest_boats && signal.nearest_boats.length > 0
    ? signal.nearest_boats[0]
    : null;

  return (
    <div
      ref={cardRef}
      className={cardClasses}
      role={isActiveHighAlert ? 'alert' : 'article'}
      aria-label={`Distress signal ${signal.id}, severity ${signal.severity_level}, status ${signal.status}`}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={signal.severity_level} />
          <StatusBadge status={signal.status} />
          {signal.status === 'Dispatched' && signal.updated_at && (
            <span className="text-xs text-green-300 font-mono whitespace-nowrap">
              Dispatched {formatRelativeTime(signal.updated_at)}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-slate-500 shrink-0">
          #{signal.id.slice(-6).toUpperCase()}
        </span>
      </div>

      <div className="mb-3">
        <ConfidenceBar score={signal.ai_confidence_score} />
      </div>

      <div className="mb-3">
        <NeedsChipList needs={signal.specific_needs} />
      </div>

      {/* ── RECOMMENDED ASSET SECTION (PHASE 5) ───────────────────────── */}
      {recommendedBoat && signal.status === 'Pending_Human_Review' && (
        <div className="mb-4 p-3 bg-slate-900/50 border border-blue-500/30 rounded-lg shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <BoatIcon />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
              AI Recommended Asset
            </span>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-200">
                {recommendedBoat.name}
              </p>
              <p className="text-[11px] text-slate-400">
                ID: {recommendedBoat.boat_id} • Cap: {recommendedBoat.capacity} pax
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-bold text-blue-300">
                {recommendedBoat.distance_km}km
              </p>
              <p className="text-[10px] text-slate-500 italic">Dist. from victim</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <CoordinatesTag coords={signal.gps_coordinates} />
        {signal.created_at && (
          <span className="text-xs text-slate-500 font-mono shrink-0">
            {new Date(signal.created_at).toLocaleTimeString('en-MY', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        )}
      </div>

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