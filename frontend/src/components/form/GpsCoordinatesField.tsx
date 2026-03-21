import { useState } from 'react'
import { MapPin, Loader2, Navigation } from 'lucide-react'
import type { GpsCoordinates } from '@/types/signal.types'
import {
  getCurrentPosition,
  getMockPosition,
  isGeolocationSupported,
} from '@/services/geolocationService'

// ─────────────────────────────────────────────────────────────────────────────
// GpsCoordinatesField — GPS coordinate input for the submission form
//
// Three ways to populate coordinates:
//   1. "Use my location" button — calls navigator.geolocation
//   2. "Use demo location" button — fills KL City Centre mock coords
//   3. Manual lat/lng number inputs
// ─────────────────────────────────────────────────────────────────────────────

interface GpsCoordinatesFieldProps {
  value:    GpsCoordinates | null
  onChange: (coords: GpsCoordinates) => void
  error?:   string
}

export default function GpsCoordinatesField({
  value,
  onChange,
  error,
}: GpsCoordinatesFieldProps) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const handleGeolocate = async () => {
    setLocating(true)
    setGeoError(null)
    const result = await getCurrentPosition()
    setLocating(false)
    if (result.success) {
      onChange(result.coords)
    } else {
      setGeoError(result.error.message)
    }
  }

  const handleDemo = () => {
    setGeoError(null)
    onChange(getMockPosition())
  }

  const handleManual = (field: 'lat' | 'lng', raw: string) => {
    const parsed = parseFloat(raw)
    if (isNaN(parsed)) return
    onChange({
      lat: field === 'lat' ? parsed : (value?.lat ?? 0),
      lng: field === 'lng' ? parsed : (value?.lng ?? 0),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
        <MapPin aria-hidden="true" style={{ width: 13, height: 13 }} />
        GPS Coordinates
        <span className="text-red-500" aria-hidden="true">*</span>
      </label>

      {/* Action buttons */}
      <div className="flex gap-2">
        {isGeolocationSupported() && (
          <button
            type="button"
            onClick={handleGeolocate}
            disabled={locating}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-md
              text-xs font-medium
              bg-brand/10 text-brand border border-brand/30
              hover:bg-brand/20 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
            "
          >
            {locating
              ? <Loader2 aria-hidden="true" style={{ width: 12, height: 12 }} className="animate-spin" />
              : <Navigation aria-hidden="true" style={{ width: 12, height: 12 }} />
            }
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        )}
        <button
          type="button"
          onClick={handleDemo}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-md
            text-xs font-medium
            bg-slate-700/40 text-slate-400 border border-slate-600/40
            hover:bg-slate-700/60 hover:text-slate-300
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500
          "
        >
          Use demo location
        </button>
      </div>

      {/* Manual lat/lng inputs */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="number"
            step="0.0001"
            placeholder="Latitude"
            value={value?.lat ?? ''}
            onChange={e => handleManual('lat', e.target.value)}
            aria-label="Latitude"
            className="
              w-full px-3 py-1.5 rounded-md text-xs font-mono
              bg-[#21262d] border border-[#30363d] text-slate-300
              placeholder:text-slate-600
              focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand
            "
          />
        </div>
        <div className="flex-1">
          <input
            type="number"
            step="0.0001"
            placeholder="Longitude"
            value={value?.lng ?? ''}
            onChange={e => handleManual('lng', e.target.value)}
            aria-label="Longitude"
            className="
              w-full px-3 py-1.5 rounded-md text-xs font-mono
              bg-[#21262d] border border-[#30363d] text-slate-300
              placeholder:text-slate-600
              focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand
            "
          />
        </div>
      </div>

      {/* Coordinate display when set */}
      {value && (
        <p className="text-xs font-mono text-slate-500">
          {value.lat.toFixed(6)}° N, {value.lng.toFixed(6)}° E
        </p>
      )}

      {/* Errors */}
      {(geoError || error) && (
        <p className="text-xs text-red-400" role="alert">
          {geoError ?? error}
        </p>
      )}
    </div>
  )
}