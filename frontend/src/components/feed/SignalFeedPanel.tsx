import { useSignalContext } from '@/context/SignalContext'
import { useSignalFeed }    from '@/hooks/useSignalFeed'
import FeedFilterBar        from './FeedFilterBar'
import SignalList           from './SignalList'
import { WifiOff, Loader2 } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// SignalFeedPanel — right panel of the dashboard
//
// Owns the polling lifecycle via useSignalFeed().
// Renders: panel header (title + live count) → filter bar → scrollable card list
// Shows connection error banner when 3 consecutive polls fail.
// ─────────────────────────────────────────────────────────────────────────────

export default function SignalFeedPanel() {
  // Mount the polling hook here — it dispatches into context automatically
  useSignalFeed()

  const { state } = useSignalContext()
  const { signals, filteredSignals, activeFilter, isPolling, pollError, lastSyncedAt } = state

  const totalCount    = signals.length
  const filteredCount = filteredSignals.length

  // Format "last synced" as a relative time string
  const lastSyncLabel = lastSyncedAt
    ? `${Math.round((Date.now() - lastSyncedAt.getTime()) / 1000)}s ago`
    : 'never'

  return (
    <section
      aria-label="Incoming distress signals feed"
      className="flex flex-col h-full bg-[#161b22] border-l border-[#30363d]"
    >
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 font-display">
            Incoming Signals
            <span className="ml-2 text-xs font-mono font-normal text-slate-500">
              ({activeFilter === 'All' ? totalCount : `${filteredCount} / ${totalCount}`})
            </span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">
            Last sync: {lastSyncLabel}
          </p>
        </div>

        {/* Live / connecting indicator */}
        <div className="flex items-center gap-1.5">
          {isPolling && !pollError ? (
            <>
              <span
                className="inline-block w-2 h-2 rounded-full bg-green-500 animate-live-dot"
                aria-hidden="true"
              />
              <span className="text-xs text-green-500 font-mono">Live</span>
            </>
          ) : pollError ? null : (
            <>
              <Loader2
                aria-hidden="true"
                style={{ width: 13, height: 13 }}
                className="text-amber-500 animate-spin"
              />
              <span className="text-xs text-amber-500 font-mono">Connecting…</span>
            </>
          )}
        </div>
      </div>

      {/* ── Connection error banner ────────────────────────────────────── */}
      {pollError && (
        <div
          role="alert"
          className="
            mx-3 mb-2 px-3 py-2 rounded-md
            bg-red-900/20 border border-red-800/40
            flex items-center gap-2
          "
        >
          <WifiOff
            aria-hidden="true"
            style={{ width: 14, height: 14 }}
            className="text-red-400 shrink-0"
          />
          <p className="text-xs text-red-400">
            Connection lost — {pollError}
          </p>
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────────── */}
      <div className="shrink-0">
        <FeedFilterBar />
      </div>

      {/* ── Scrollable signal list ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <SignalList />
      </div>
    </section>
  )
}