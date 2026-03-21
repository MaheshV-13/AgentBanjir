import type { SeverityLevel } from '@/types/signal.types'
import { SEVERITY_STYLES } from '@/utils/severityStyles'

// ─────────────────────────────────────────────────────────────────────────────
// SeverityBadge — coloured pill chip for severity level
//
// WCAG 1.4.1: severity is conveyed by colour AND text label — not colour alone.
// WCAG 1.3.1: aria-label includes the word "Severity:" for screen readers.
// ─────────────────────────────────────────────────────────────────────────────

interface SeverityBadgeProps {
  severity: SeverityLevel
  /** Compact mode omits the word "Severity:" from the visible label */
  compact?: boolean
}

export default function SeverityBadge({ severity, compact = false }: SeverityBadgeProps) {
  const s = SEVERITY_STYLES[severity]

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5
        rounded-full text-xs font-mono font-medium uppercase tracking-wider
        ${s.badgeBg} ${s.badgeText}
      `}
      aria-label={s.ariaLabel}
    >
      {/* Colour dot — redundant with text but aids quick scanning */}
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${s.badgeText.replace('text-', 'bg-')}`}
        aria-hidden="true"
      />
      {compact ? severity : `${severity}`}
    </span>
  )
}