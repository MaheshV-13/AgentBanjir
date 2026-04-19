/**
 * Converts an ISO timestamp into a human-readable relative string.
 *
 * Hackathon UX requirement: no ticking clock / no setInterval. Callers render
 * this during React render, and polling naturally refreshes every few seconds.
 */
export function formatRelativeTime(iso?: string | null, nowMs: number = Date.now()): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'

  const diffMs = nowMs - t
  if (diffMs <= 0) return 'just now'

  const sec = Math.floor(diffMs / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`

  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`

  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`

  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

