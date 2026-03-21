import type { MapMarker } from '@/hooks/useMapMarkers'

// ─────────────────────────────────────────────────────────────────────────────
// MarkerPopup — mini signal summary rendered inside a Leaflet Popup
//
// Leaflet injects this into its own DOM outside the React tree, so:
//   • No Tailwind utility classes — Leaflet's popup CSS applies instead
//   • Inline styles only for reliable rendering inside the Leaflet container
//   • Uses the dark overrides defined in index.css (.leaflet-popup-content-wrapper)
// ─────────────────────────────────────────────────────────────────────────────

interface MarkerPopupProps {
  marker: MapMarker
}

const SEVERITY_COLOUR: Record<string, string> = {
  High:   '#f85149',
  Medium: '#d29922',
  Low:    '#58a6ff',
}

const STATUS_LABEL: Record<string, string> = {
  Pending_Human_Review: 'Pending Review',
  Dispatched:           'Dispatched',
  Rejected:             'Rejected',
}

export default function MarkerPopup({ marker }: MarkerPopupProps) {
  const severityColour = marker.status === 'Dispatched'
    ? '#3fb950'
    : (SEVERITY_COLOUR[marker.severity] ?? '#6e7681')

  return (
    <div style={{ minWidth: 180, maxWidth: 240, fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* Severity + status row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 8px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: `${severityColour}22`,
          color: severityColour,
          border: `1px solid ${severityColour}44`,
        }}>
          {marker.severity}
        </span>
        <span style={{ fontSize: 11, color: '#6e7681' }}>
          {STATUS_LABEL[marker.status] ?? marker.status}
        </span>
      </div>

      {/* Message preview */}
      <p style={{
        fontSize: 12,
        color: '#cdd9e5',
        margin: '0 0 8px',
        lineHeight: 1.4,
        wordBreak: 'break-word',
      }}>
        {marker.label}
      </p>

      {/* Confidence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#6e7681', flexShrink: 0 }}>AI confidence</span>
        <div style={{ flex: 1, height: 4, background: '#30363d', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${marker.confidence}%`,
            height: '100%',
            background: marker.confidence >= 75 ? '#3fb950' : marker.confidence >= 50 ? '#d29922' : '#f85149',
            borderRadius: 2,
          }} />
        </div>
        <span style={{ fontSize: 11, color: '#8b949e', flexShrink: 0, fontFamily: 'monospace' }}>
          {marker.confidence}%
        </span>
      </div>

      {/* Needs chips */}
      {marker.specificNeeds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {marker.specificNeeds.slice(0, 3).map(need => (
            <span key={need} style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: '#21262d',
              color: '#8b949e',
              border: '1px solid #30363d',
            }}>
              {need.replace(/_/g, ' ')}
            </span>
          ))}
          {marker.specificNeeds.length > 3 && (
            <span style={{ fontSize: 10, color: '#6e7681' }}>
              +{marker.specificNeeds.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Coordinates */}
      <p style={{
        fontSize: 10,
        color: '#484f58',
        margin: '8px 0 0',
        fontFamily: 'monospace',
      }}>
        {marker.lat.toFixed(4)}° N, {marker.lng.toFixed(4)}° E
      </p>
    </div>
  )
}