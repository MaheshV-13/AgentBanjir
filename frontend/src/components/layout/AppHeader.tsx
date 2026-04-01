import { useSignalContext } from '@/context/SignalContext'

// ─────────────────────────────────────────────────────────────────────────────
// AppHeader — top navigation bar
//
// Shows:
//   • AgentBanjir brand name + tagline
//   • Pulsing live indicator dot (green = polling, amber = connecting)
//   • Last sync timestamp
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'victim' | 'dispatcher'

export default function AppHeader({
  view,
  onViewChange,
}: {
  view: ViewMode
  onViewChange: (view: ViewMode) => void
}) {
  const { state } = useSignalContext()
  const { isPolling, pollError, lastSyncedAt } = state

  const lastSyncLabel = lastSyncedAt
    ? `${Math.round((Date.now() - lastSyncedAt.getTime()) / 1000)}s ago`
    : '—'

  return (
    <header
      className="
        flex items-center justify-between
        px-5 py-3 shrink-0
        bg-[#161b22] border-b border-[#30363d]
      "
      role="banner"
    >
      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Logo mark — simple flood-wave SVG */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect width="28" height="28" rx="6" fill="#1a6dff" opacity="0.15" />
          <path
            d="M4 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
            stroke="#1a6dff"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M4 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
            stroke="#58a6ff"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M10 10 L14 6 L18 10"
            stroke="#f85149"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>

        <div>
          <h1
            className="
              text-sm font-semibold font-display leading-none
              bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-400
            "
          >
            AgentBanjir
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">
            Command Center Dashboard
          </p>
        </div>
      </div>

      {/* ── Status indicators ───────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* ── Role toggle ──────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Select dashboard role"
          className="flex sm:flex items-center gap-1 rounded-md bg-[#0d1117] border border-[#30363d] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'victim'}
            onClick={() => onViewChange('victim')}
            className={`
              px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1
              focus-visible:ring-offset-[#161b22]
              ${view === 'victim'
                ? 'border-brand text-slate-100 bg-brand/15'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#161b22]'}
            `}
          >
            Victim
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'dispatcher'}
            onClick={() => onViewChange('dispatcher')}
            className={`
              px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1
              focus-visible:ring-offset-[#161b22]
              ${view === 'dispatcher'
                ? 'border-brand text-slate-100 bg-brand/15'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#161b22]'}
            `}
          >
            Dispatcher
          </button>
        </div>

        {/* Last sync */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-xs text-slate-600 font-mono">Last sync:</span>
          <span className="text-xs text-slate-400 font-mono">{lastSyncLabel}</span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-4 w-px bg-[#30363d]" aria-hidden="true" />

        {/* Live / error indicator */}
        {view === 'victim' ? (
          <div className="flex items-center gap-1.5" aria-label="Victim mode">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
            <span className="text-xs text-amber-300 font-mono">Victim view</span>
          </div>
        ) : pollError ? (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full bg-red-500"
              aria-hidden="true"
            />
            <span className="text-xs text-red-400 font-mono">Disconnected</span>
          </div>
        ) : isPolling ? (
          <div
            className="flex items-center gap-1.5"
            aria-label="Feed connected — live updates active"
          >
            <span
              className="inline-block w-2 h-2 rounded-full bg-green-500 animate-live-dot"
              aria-hidden="true"
            />
            <span className="text-xs text-green-500 font-mono">Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"
              aria-hidden="true"
            />
            <span className="text-xs text-amber-500 font-mono">Connecting…</span>
          </div>
        )}
      </div>
    </header>
  )
}