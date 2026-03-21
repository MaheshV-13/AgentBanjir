import { useSignalContext } from '@/context/SignalContext'

// ─────────────────────────────────────────────────────────────────────────────
// AppHeader — top navigation bar
//
// Shows:
//   • AgentBanjir brand name + tagline
//   • Pulsing live indicator dot (green = polling, amber = connecting)
//   • Last sync timestamp
// ─────────────────────────────────────────────────────────────────────────────

export default function AppHeader() {
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
          <h1 className="text-sm font-semibold text-slate-200 font-display leading-none">
            AgentBanjir
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">
            Command Center Dashboard
          </p>
        </div>
      </div>

      {/* ── Status indicators ───────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Last sync */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-xs text-slate-600 font-mono">Last sync:</span>
          <span className="text-xs text-slate-400 font-mono">{lastSyncLabel}</span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-4 w-px bg-[#30363d]" aria-hidden="true" />

        {/* Live / error indicator */}
        {pollError ? (
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