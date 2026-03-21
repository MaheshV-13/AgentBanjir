// ─────────────────────────────────────────────────────────────────────────────
// NeedsChipList — renders specific_needs as a horizontal chip row
//
// Need strings from the API use snake_case (e.g. "rescue_boat").
// They are formatted to Title Case for display.
// ─────────────────────────────────────────────────────────────────────────────

interface NeedsChipListProps {
  needs: string[]
  /** Max chips to show before collapsing with a "+N more" chip */
  maxVisible?: number
}

function formatNeed(need: string): string {
  return need
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function NeedsChipList({ needs, maxVisible = 4 }: NeedsChipListProps) {
  if (needs.length === 0) {
    return (
      <span className="text-xs text-slate-600 italic">No specific needs listed</span>
    )
  }

  const visible  = needs.slice(0, maxVisible)
  const overflow = needs.length - maxVisible

  return (
    <div
      className="flex flex-wrap gap-1"
      aria-label={`Specific needs: ${needs.map(formatNeed).join(', ')}`}
    >
      {visible.map((need) => (
        <span
          key={need}
          className="
            inline-block px-2 py-0.5
            bg-slate-700/60 text-slate-300
            text-xs rounded-md border border-slate-600/40
          "
        >
          {formatNeed(need)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="
            inline-block px-2 py-0.5
            bg-slate-700/40 text-slate-500
            text-xs rounded-md border border-slate-600/30
          "
          title={needs.slice(maxVisible).map(formatNeed).join(', ')}
        >
          +{overflow} more
        </span>
      )}
    </div>
  )
}