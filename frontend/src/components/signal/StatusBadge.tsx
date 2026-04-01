import type { SignalStatus } from '@/types/signal.types'
import { STATUS_STYLES } from '@/utils/severityStyles'

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — pill chip for signal lifecycle status
// ─────────────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: SignalStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const s = STATUS_STYLES[status]
  const isDispatched = status === 'Dispatched'

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        rounded-full text-xs font-medium
        ${s.bg} ${s.text}
        ${isDispatched ? 'relative overflow-hidden' : ''}
        ${isDispatched
          ? "before:content-[''] before:absolute before:top-0 before:left-0 before:h-full before:w-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:pointer-events-none before:animate-dispatched-badge-sweep"
          : ''}
      `}
      aria-label={`Status: ${s.label}`}
    >
      <span className={isDispatched ? 'relative z-10' : ''}>{s.label}</span>
    </span>
  )
}