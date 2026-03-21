import type { SeverityLevel, SignalStatus } from '@/types/signal.types'

// ─────────────────────────────────────────────────────────────────────────────
// Centralised severity / status → Tailwind class mapping.
// All visual decisions live here so components stay declarative.
// ─────────────────────────────────────────────────────────────────────────────

interface SeverityStyle {
  /** Card background tint */
  cardBg:     string
  /** Left border accent */
  border:     string
  /** Glow utility class */
  glow:       string
  /** Whether the high-severity pulse animation is active */
  pulse:      boolean
  /** Badge background */
  badgeBg:    string
  /** Badge text colour */
  badgeText:  string
  /** Map marker hex colour — used by SignalMarker to colour SVG icons */
  markerHex:  string
  /** aria-label text */
  ariaLabel:  string
}

export const SEVERITY_STYLES: Record<SeverityLevel, SeverityStyle> = {
  High: {
    cardBg:    'bg-[#2d1318]',
    border:    'border-l-4 border-red-600',
    glow:      'severity-glow-high',
    pulse:     true,
    badgeBg:   'bg-red-600/20',
    badgeText: 'text-red-400',
    markerHex: '#f85149',
    ariaLabel: 'Severity: High',
  },
  Medium: {
    cardBg:    'bg-[#2d2005]',
    border:    'border-l-4 border-amber-600',
    glow:      'severity-glow-medium',
    pulse:     false,
    badgeBg:   'bg-amber-600/20',
    badgeText: 'text-amber-400',
    markerHex: '#d29922',
    ariaLabel: 'Severity: Medium',
  },
  Low: {
    cardBg:    'bg-[#051d40]',
    border:    'border-l-4 border-blue-700',
    glow:      'severity-glow-low',
    pulse:     false,
    badgeBg:   'bg-blue-700/20',
    badgeText: 'text-blue-400',
    markerHex: '#58a6ff',
    ariaLabel: 'Severity: Low',
  },
}

interface StatusStyle {
  bg:    string
  text:  string
  label: string
}

export const STATUS_STYLES: Record<SignalStatus, StatusStyle> = {
  Pending_Human_Review: {
    bg:    'bg-amber-600/15',
    text:  'text-amber-400',
    label: 'Pending Review',
  },
  Dispatched: {
    bg:    'bg-green-700/15',
    text:  'text-green-400',
    label: 'Dispatched',
  },
  // Q5: Rejected signals stay in feed but are visually dimmed (opacity-40)
  Rejected: {
    bg:    'bg-slate-600/15',
    text:  'text-slate-500',
    label: 'Rejected',
  },
}

/**
 * Returns Tailwind classes for a SignalCard wrapper.
 * Rejected signals get the dimmed treatment per Q5 answer.
 */
export function getCardClasses(
  severity:    SeverityLevel,
  status:      SignalStatus,
  isHighlighted: boolean,
): string {
  const s = SEVERITY_STYLES[severity]
  const isRejected = status === 'Rejected'
  const isDispatched = status === 'Dispatched'

  const base = [
    'rounded-lg',
    'p-4',
    'transition-all',
    'duration-200',
    'animate-slide-in',
    s.border,
    s.glow,
    // Rejected: keep in feed but dim (Q5 confirmed)
    isRejected  ? 'opacity-40 pointer-events-none' : '',
    // Dispatched: green tint replaces severity tint
    isDispatched ? 'bg-[#0c2d1a]' : s.cardBg,
    // Highlighted (map pin click): elevated ring
    isHighlighted ? 'ring-2 ring-brand ring-offset-1 ring-offset-[#0d1117]' : '',
    // Pulse animation for High severity (respects prefers-reduced-motion via CSS)
    s.pulse && !isDispatched && !isRejected ? 'animate-severity-pulse' : '',
  ]

  return base.filter(Boolean).join(' ')
}