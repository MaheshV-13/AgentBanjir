// ─────────────────────────────────────────────────────────────────────────────
// ConfidenceBar — horizontal progress bar for ai_confidence_score (0–100)
//
// Colour transitions green → amber → red as confidence decreases so operators
// can instantly see how much they should trust the AI triage decision.
// ─────────────────────────────────────────────────────────────────────────────

interface ConfidenceBarProps {
  /** Integer 0–100 */
  score: number
}

type ConfidenceTier = 'high' | 'medium' | 'low'

function getTier(score: number): ConfidenceTier {
  if (score > 85) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

function getTierGradientClasses(tier: ConfidenceTier): string {
  switch (tier) {
    case 'high':
      return 'bg-gradient-to-r from-emerald-400 to-teal-500'
    case 'medium':
      return 'bg-gradient-to-r from-amber-400 to-amber-500'
    default:
      return 'bg-gradient-to-r from-rose-400 to-red-500'
  }
}

function getTierTextGradientClasses(tier: ConfidenceTier): string {
  return `bg-clip-text text-transparent ${getTierGradientClasses(tier)}`
}

export default function ConfidenceBar({ score }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const tier     = getTier(clamped)
  const barBg    = getTierGradientClasses(tier)
  const textGrad = getTierTextGradientClasses(tier)

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-16 shrink-0 ${textGrad}`}>
        AI confidence
      </span>
      <div
        className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`AI confidence score: ${clamped}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barBg} ${tier === 'high' ? 'animate-confidence-high-glow' : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`text-xs font-mono w-8 text-right shrink-0 ${textGrad}`}>
        {clamped}%
      </span>
    </div>
  )
}