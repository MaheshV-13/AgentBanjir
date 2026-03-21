// ─────────────────────────────────────────────────────────────────────────────
// MapLegend — colour key overlay for severity levels
//
// Positioned as an absolute overlay inside the map container (not a Leaflet
// control) so it stays within our React/Tailwind styling system.
// ─────────────────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { colour: '#f85149', label: 'High'        },
  { colour: '#d29922', label: 'Medium'      },
  { colour: '#58a6ff', label: 'Low'         },
  { colour: '#3fb950', label: 'Dispatched'  },
]

export default function MapLegend() {
  return (
    <div
      className="
        absolute bottom-6 left-3 z-[1000]
        bg-[#161b22]/90 backdrop-blur-sm
        border border-[#30363d] rounded-lg
        px-3 py-2.5 flex flex-col gap-1.5
      "
      aria-label="Map severity legend"
    >
      <p className="text-xs text-slate-600 font-medium mb-0.5 uppercase tracking-wider">
        Severity
      </p>
      {LEGEND_ITEMS.map(({ colour, label }) => (
        <div key={label} className="flex items-center gap-2">
          <svg
            width="12"
            height="16"
            viewBox="0 0 26 34"
            aria-hidden="true"
            className="shrink-0"
          >
            <path
              d="M13 0C7.477 0 3 4.477 3 10c0 7.5 10 24 10 24S23 17.5 23 10c0-5.523-4.477-10-10-10z"
              fill={colour}
              opacity="0.95"
            />
            <circle cx="13" cy="10" r="5" fill="white" opacity="0.9" />
          </svg>
          <span className="text-xs text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  )
}