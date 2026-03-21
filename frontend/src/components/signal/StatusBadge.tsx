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

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        rounded-full text-xs font-medium
        ${s.bg} ${s.text}
      `}
      aria-label={`Status: ${s.label}`}
    >
      {s.label}
    </span>
  )
}