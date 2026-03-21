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

function getBarColour(score: number): string {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function ConfidenceBar({ score }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const colour  = getBarColour(clamped)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 font-mono w-16 shrink-0">
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
          className={`h-full rounded-full transition-all duration-500 ${colour}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-mono text-slate-400 w-8 text-right shrink-0">
        {clamped}%
      </span>
    </div>
  )
}