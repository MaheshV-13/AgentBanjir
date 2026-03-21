import { useMemo } from 'react'
import { useSignalContext } from '@/context/SignalContext'

// ─────────────────────────────────────────────────────────────────────────────
// StatsBar — bottom summary row showing live signal counts
//
// Counts are derived from the full signals array (not filteredSignals) so the
// numbers always reflect the true state regardless of the active filter tab.
// ─────────────────────────────────────────────────────────────────────────────

interface StatTileProps {
  label:   string
  count:   number
  colour:  string
}

function StatTile({ label, count, colour }: StatTileProps) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2"
      aria-label={`${label}: ${count}`}
    >
      <span className={`text-lg font-mono font-semibold ${colour}`}>
        {count}
      </span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

export default function StatsBar() {
  const { state } = useSignalContext()
  const { signals } = state

  const stats = useMemo(() => ({
    total:      signals.length,
    high:       signals.filter(s => s.severity_level === 'High'   && s.status !== 'Rejected').length,
    pending:    signals.filter(s => s.status === 'Pending_Human_Review').length,
    dispatched: signals.filter(s => s.status === 'Dispatched').length,
    rejected:   signals.filter(s => s.status === 'Rejected').length,
  }), [signals])

  return (
    <footer
      className="
        flex items-center shrink-0
        bg-[#161b22] border-t border-[#30363d]
        divide-x divide-[#30363d]
        overflow-x-auto
      "
      aria-label="Signal statistics"
    >
      <StatTile label="Total signals"   count={stats.total}      colour="text-slate-300" />
      <StatTile label="High severity"   count={stats.high}       colour="text-red-400"   />
      <StatTile label="Pending review"  count={stats.pending}    colour="text-amber-400" />
      <StatTile label="Dispatched"      count={stats.dispatched} colour="text-green-400" />
      <StatTile label="Rejected"        count={stats.rejected}   colour="text-slate-600" />
    </footer>
  )
}