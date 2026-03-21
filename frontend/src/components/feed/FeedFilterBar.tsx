import type { FilterOption } from '@/types/signal.types'
import { useSignalContext } from '@/context/SignalContext'

// ─────────────────────────────────────────────────────────────────────────────
// FeedFilterBar — client-side filter tab row for the signal feed
//
// Filters are applied in-memory — no re-fetch on tab switch.
// Active tab is synced to SignalContext.activeFilter.
// ─────────────────────────────────────────────────────────────────────────────

const FILTERS: { label: string; value: FilterOption }[] = [
  { label: 'All',        value: 'All'        },
  { label: 'High',       value: 'High'       },
  { label: 'Pending',    value: 'Pending'    },
  { label: 'Dispatched', value: 'Dispatched' },
]

const ACTIVE_COLOURS: Record<FilterOption, string> = {
  All:        'border-brand text-brand bg-brand/10',
  High:       'border-red-500 text-red-400 bg-red-500/10',
  Pending:    'border-amber-500 text-amber-400 bg-amber-500/10',
  Dispatched: 'border-green-500 text-green-400 bg-green-500/10',
}

export default function FeedFilterBar() {
  const { state, dispatch } = useSignalContext()
  const active = state.activeFilter

  return (
    <div
      role="tablist"
      aria-label="Filter signals by status"
      className="flex gap-1 px-3 pb-2"
    >
      {FILTERS.map(({ label, value }) => {
        const isActive = active === value
        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            onClick={() => dispatch({ type: 'SET_FILTER', payload: value })}
            className={`
              px-3 py-1 rounded-md text-xs font-medium border transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-brand focus-visible:ring-offset-1
              focus-visible:ring-offset-[#0d1117]
              ${isActive
                ? ACTIVE_COLOURS[value]
                : 'border-slate-700 text-slate-500 bg-transparent hover:text-slate-300 hover:border-slate-500'
              }
            `}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}