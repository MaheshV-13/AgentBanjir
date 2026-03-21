import L from 'leaflet'
import iconUrl       from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl     from 'leaflet/dist/images/marker-shadow.png'

// ─────────────────────────────────────────────────────────────────────────────
// Leaflet default icon fix
//
// React-Leaflet's bundler strips the default icon image references from
// Leaflet's CSS. This file re-wires them so fallback markers render correctly.
// Import this once in main.tsx before the app mounts.
//
// Note: SignalMarker uses custom SVG DivIcons so this only affects any
// accidental use of the default Leaflet marker.
// ─────────────────────────────────────────────────────────────────────────────

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })