import LiveMapPanel    from '@/components/map/LiveMapPanel'
import SignalFeedPanel from '@/components/feed/SignalFeedPanel'

// ─────────────────────────────────────────────────────────────────────────────
// DashboardLayout — CSS Grid two-panel wrapper
//
// Responsive breakpoints (SDD §5.2):
//   xl  (1280+) → side-by-side  map 60% / feed 40%
//   lg  (1024+) → side-by-side  map 55% / feed 45%
//   md  (768)   → single column: map on top (300px), feed below
//   sm  (<768)  → single column: map collapsed (200px), feed full width
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  return (
    <div
      className="
        h-full min-h-0
        grid
        grid-cols-1
        md:grid-cols-[55fr_45fr]
        xl:grid-cols-[60fr_40fr]
      "
    >
      {/* ── Left: Live map ─────────────────────────────────────────────── */}
      <div
        className="
          min-h-0 overflow-hidden
          h-[200px] sm:h-[260px] md:h-full
          border-b border-[#30363d]
          md:border-b-0 md:border-r
        "
      >
        <LiveMapPanel />
      </div>

      {/* ── Right: Signal feed ─────────────────────────────────────────── */}
      <div className="min-h-0 overflow-hidden flex flex-col">
        <SignalFeedPanel />
      </div>
    </div>
  )
}