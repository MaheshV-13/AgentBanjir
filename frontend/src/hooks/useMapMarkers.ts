import { useMemo } from 'react'
import { useSignalContext } from '@/context/SignalContext'
import { SEVERITY_STYLES } from '@/utils/severityStyles'
import type { EnrichedSignal } from '@/types/signal.types'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — useMapMarkers
//
// Derives the data needed to render Leaflet markers from the global signal
// state. Memoised so LiveMapPanel only re-renders when signals actually change.
//
// Rejected signals are excluded from the map (they're dimmed in the feed but
// removing them from the map keeps it uncluttered during a demo).
// ─────────────────────────────────────────────────────────────────────────────

export interface MapMarker {
  id:          string
  lat:         number
  lng:         number
  /** Hex colour for the SVG marker icon — driven by severity */
  colour:      string
  /** Hex colour for dispatched signals (green override) */
  severity:    EnrichedSignal['severity_level']
  status:      EnrichedSignal['status']
  /** Whether this marker is currently selected (elevated z-index on map) */
  isSelected:  boolean
  /** Short label shown in MarkerPopup */
  label:       string
  /** Confidence score for popup display */
  confidence:  number
  specificNeeds: string[]
}

export interface UseMapMarkersResult {
  markers:          MapMarker[]
  /** The selected marker object, or null */
  selectedMarker:   MapMarker | null
  /** Bounds array for Leaflet fitBounds — [[minLat, minLng], [maxLat, maxLng]] */
  bounds:           [[number, number], [number, number]] | null
  /** True if there is at least one High severity non-dispatched signal */
  hasActiveHighAlert: boolean
}

export function useMapMarkers(): UseMapMarkersResult {
  const { state } = useSignalContext()
  const { signals, selectedSignalId } = state

  const markers = useMemo<MapMarker[]>(() => {
    return signals
      .filter(s => s.status !== 'Rejected')
      .map(s => {
        const isDispatched = s.status === 'Dispatched'
        const colour = isDispatched
          ? SEVERITY_STYLES[s.severity_level].markerHex  // green for dispatched
          : SEVERITY_STYLES[s.severity_level].markerHex

        return {
          id:           s.id,
          lat:          s.gps_coordinates.lat,
          lng:          s.gps_coordinates.lng,
          colour:       isDispatched ? '#3fb950' : colour,
          severity:     s.severity_level,
          status:       s.status,
          isSelected:   s.id === selectedSignalId,
          label:        s.raw_message?.slice(0, 40) ?? `Signal ${s.id}`,
          confidence:   s.ai_confidence_score,
          specificNeeds: s.specific_needs,
        }
      })
  }, [signals, selectedSignalId])

  const selectedMarker = useMemo(
    () => markers.find(m => m.id === selectedSignalId) ?? null,
    [markers, selectedSignalId],
  )

  // Calculate bounds for fitBounds — only when there are markers
  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (markers.length === 0) return null

    const lats = markers.map(m => m.lat)
    const lngs = markers.map(m => m.lng)

    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]
  }, [markers])

  const hasActiveHighAlert = useMemo(
    () => markers.some(
      m => m.severity === 'High' && m.status === 'Pending_Human_Review',
    ),
    [markers],
  )

  return { markers, selectedMarker, bounds, hasActiveHighAlert }
}