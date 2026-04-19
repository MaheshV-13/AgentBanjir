import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapMarkers }   from '@/hooks/useMapMarkers'
import { useSignalContext } from '@/context/SignalContext'
import SignalMarker        from './SignalMarker'
import MapLegend           from './MapLegend'

// ─────────────────────────────────────────────────────────────────────────────
// LiveMapPanel — left panel of the dashboard
//
// Renders a Leaflet map centred on Malaysia with severity-coloured pin markers
// for every active (non-Rejected) signal.
//
// Behaviour:
//   • On first signals load: fitBounds to show all markers
//   • New High severity signal arrives: panTo that signal's coordinates
//   • Map pin clicked: dispatches SELECT_SIGNAL (handled in SignalMarker)
//   • No signals: centred on Malaysia at zoom 6
//
// Leaflet CSS is imported here — it must load before MapContainer renders.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [
  Number(import.meta.env.VITE_MAP_DEFAULT_LAT)  || 4.2105,
  Number(import.meta.env.VITE_MAP_DEFAULT_LNG)  || 108.9758,
]
const DEFAULT_ZOOM = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM) || 6

// ── Inner component — has access to useMap() hook ────────────────────────────

function MapController() {
  const map                  = useMap()
  const { markers, bounds } = useMapMarkers()
  const { state }            = useSignalContext()
  const prevCountRef         = useRef(0)
  const hasFitBoundsRef      = useRef(false)

  useEffect(() => {
    if (markers.length === 0) return

    // First load — fit all markers into view
    if (!hasFitBoundsRef.current && bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true })
      hasFitBoundsRef.current = true
      prevCountRef.current = markers.length
      return
    }

    // New signal arrived — if it's High severity, pan to it
    if (markers.length > prevCountRef.current) {
      const newMarkers = markers.slice(0, markers.length - prevCountRef.current)
      const highNew    = newMarkers.find(m => m.severity === 'High' && m.status === 'Pending_Human_Review')
      if (highNew) {
        map.panTo([highNew.lat, highNew.lng], { animate: true, duration: 0.8 })
      }
    }

    prevCountRef.current = markers.length
  }, [markers, bounds, map])

  // Pan to selected marker when selected via feed card click
  useEffect(() => {
    if (!state.selectedSignalId) return
    const m = markers.find(mk => mk.id === state.selectedSignalId)
    if (m) {
      map.panTo([m.lat, m.lng], { animate: true, duration: 0.5 })
    }
  }, [state.selectedSignalId, markers, map])

  return (
    <>
      {markers.map(marker => (
        <SignalMarker key={marker.id} marker={marker} />
      ))}
    </>
  )
}

// ── Outer component — renders MapContainer ───────────────────────────────────

export default function LiveMapPanel() {
  const { markers } = useMapMarkers()

  return (
    <section
      aria-label="Live signal map"
      className="relative h-full w-full"
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl={true}
        attributionControl={false}
      >
        {/* OpenStreetMap tiles — no API key required */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Markers + auto-pan logic */}
        <MapController />
      </MapContainer>

      {/* Legend overlay — outside MapContainer so it uses Tailwind */}
      <MapLegend />

      {/* No signals empty state */}
      {markers.length === 0 && (
        <div className="
          absolute inset-0 flex flex-col items-center justify-center
          pointer-events-none gap-2 text-slate-700
        ">
          <span className="text-4xl" aria-hidden="true">🗺️</span>
          <p className="text-sm">Waiting for signals…</p>
        </div>
      )}
    </section>
  )
}