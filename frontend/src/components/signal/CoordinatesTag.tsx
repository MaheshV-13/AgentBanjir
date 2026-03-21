import type { GpsCoordinates } from '@/types/signal.types'
import { MapPin } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// CoordinatesTag — displays GPS lat/lng with a map-pin icon
//
// Uses JetBrains Mono (font-mono) for the coordinate values so digits align
// cleanly in the card layout.
// ─────────────────────────────────────────────────────────────────────────────

interface CoordinatesTagProps {
  coords: GpsCoordinates
}

export default function CoordinatesTag({ coords }: CoordinatesTagProps) {
  const lat = coords.lat.toFixed(4)
  const lng = coords.lng.toFixed(4)

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono"
      aria-label={`GPS coordinates: ${lat}° N, ${lng}° E`}
    >
      <MapPin
        aria-hidden="true"
        style={{ width: 12, height: 12 }}
        className="text-slate-600 shrink-0"
      />
      {lat}° N, {lng}° E
    </span>
  )
}