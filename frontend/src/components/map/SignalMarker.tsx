import { useEffect, useRef } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { MapMarker } from '@/hooks/useMapMarkers'
import { useSignalContext } from '@/context/SignalContext'
import MarkerPopup from './MarkerPopup'

// ─────────────────────────────────────────────────────────────────────────────
// SignalMarker — one Leaflet marker per active signal
//
// Uses a custom SVG DivIcon so the pin colour matches severity exactly.
// Selected markers (isSelected) render at higher z-index and slightly larger.
// Clicking a marker dispatches SELECT_SIGNAL so the feed card scrolls into view.
// ─────────────────────────────────────────────────────────────────────────────

interface SignalMarkerProps {
  marker: MapMarker
}

type NeedIconKind = 'medical' | 'life_jacket' | 'boat' | 'generic'

function pickNeedIconKind(needs: string[]): NeedIconKind {
  const haystack = needs.join(' ').toLowerCase()

  if (
    haystack.includes('medical') ||
    haystack.includes('insulin') ||
    haystack.includes('hospital')
  ) {
    return 'medical'
  }

  if (haystack.includes('life_jacket') || haystack.includes('jacket')) {
    return 'life_jacket'
  }

  if (haystack.includes('boat') || haystack.includes('rescue_boat')) {
    return 'boat'
  }

  return 'generic'
}

function buildNeedIconPaths(colour: string, kind: NeedIconKind): string {
  switch (kind) {
    case 'medical':
      return `
        <path d="M13 7v6" stroke="${colour}" stroke-width="1.9" stroke-linecap="round"/>
        <path d="M10 10h6" stroke="${colour}" stroke-width="1.9" stroke-linecap="round"/>
      `
    case 'life_jacket':
      return `
        <circle cx="13" cy="10" r="3.2" fill="none" stroke="${colour}" stroke-width="1.8" opacity="0.95"/>
        <path d="M13 7.6v4.8" stroke="${colour}" stroke-width="1.8" stroke-linecap="round" opacity="0.95"/>
      `
    case 'boat':
      return `
        <path d="M10 12l3-3 3 3v3.2c0 .55-.45 1-1 1h-4c-.55 0-1-.45-1-1V12z" fill="${colour}" opacity="0.95"/>
        <path d="M13 9.1v2.1" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
      `
    default:
      return ''
  }
}

/** Build a contextual SVG pin as a Leaflet DivIcon */
function buildIcon(
  colour: string,
  isSelected: boolean,
  iconKind: NeedIconKind,
  shouldPulse: boolean,
): L.DivIcon {
  const size   = isSelected ? 32 : 26
  const shadow = isSelected ? `drop-shadow(0 0 6px ${colour}88)` : 'none'
  const pulse  = shouldPulse ? 'animation: severityPulse 1.5s ease-in-out infinite;' : ''

  const centerIcon = buildNeedIconPaths(colour, iconKind)

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.3}" viewBox="0 0 26 34">
      <path
        d="M13 0C7.477 0 3 4.477 3 10c0 7.5 10 24 10 24S23 17.5 23 10c0-5.523-4.477-10-10-10z"
        fill="${colour}"
        opacity="0.95"
      />
      <circle cx="13" cy="10" r="5" fill="white" opacity="0.9"/>
      ${centerIcon}
    </svg>
  `

  return L.divIcon({
    html:      `<div style="filter:${shadow};${pulse}">${svg}</div>`,
    iconSize:  [size, size * 1.3],
    iconAnchor:[size / 2, size * 1.3],
    popupAnchor:[0, -(size * 1.1)],
    className: '',   // clear Leaflet's default white square background
  })
}

export default function SignalMarker({ marker }: SignalMarkerProps) {
  const { dispatch } = useSignalContext()
  const markerRef    = useRef<L.Marker>(null)
  const map          = useMap()

  const iconKind = pickNeedIconKind(marker.specificNeeds)
  const shouldPulse =
    marker.severity === 'High' && marker.status === 'Pending_Human_Review'

  const icon = buildIcon(marker.colour, marker.isSelected, iconKind, shouldPulse)

  // Open popup automatically when marker becomes selected
  useEffect(() => {
    if (marker.isSelected && markerRef.current) {
      markerRef.current.openPopup()
    }
  }, [marker.isSelected])

  const handleClick = () => {
    dispatch({ type: 'SELECT_SIGNAL', payload: marker.id })
    // Pan map smoothly to clicked marker
    map.panTo([marker.lat, marker.lng], { animate: true, duration: 0.5 })
  }

  return (
    <Marker
      ref={markerRef}
      position={[marker.lat, marker.lng]}
      icon={icon}
      zIndexOffset={marker.isSelected ? 1000 : 0}
      eventHandlers={{ click: handleClick }}
      title={`Signal ${marker.id} — ${marker.severity}`}
    >
      <Popup minWidth={200} maxWidth={260}>
        <MarkerPopup marker={marker} />
      </Popup>
    </Marker>
  )
}