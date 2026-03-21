import type { GpsCoordinates } from '@/types/signal.types'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — Geolocation Service
//
// Wraps the browser's navigator.geolocation API in a Promise-based interface
// for use in SignalSubmissionForm (GpsCoordinatesField).
//
// The native API is callback-based and awkward to use with React state.
// This wrapper makes it awaitable and provides typed error codes.
// ─────────────────────────────────────────────────────────────────────────────

export type GeolocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'

export interface GeolocationError {
  code:    GeolocationErrorCode
  message: string
}

export type GeolocationResult =
  | { success: true;  coords: GpsCoordinates }
  | { success: false; error: GeolocationError }

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout:            10_000,   // 10s — generous for demo conditions
  maximumAge:         30_000,   // cache position for 30s to avoid repeated prompts
}

/**
 * Requests the device's current GPS position.
 * Returns a typed result object — never throws — so callers can pattern-match
 * on success/failure without try/catch.
 *
 * @example
 *   const result = await getCurrentPosition()
 *   if (result.success) {
 *     setCoords(result.coords)
 *   } else {
 *     setError(result.error.message)
 *   }
 */
export async function getCurrentPosition(): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    return {
      success: false,
      error: {
        code:    'NOT_SUPPORTED',
        message: 'Geolocation is not supported by this browser.',
      },
    }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          coords: {
            lat: parseFloat(position.coords.latitude.toFixed(6)),
            lng: parseFloat(position.coords.longitude.toFixed(6)),
          },
        })
      },
      (err) => {
        resolve({
          success: false,
          error: {
            code:    mapGeolocationErrorCode(err.code),
            message: mapGeolocationErrorMessage(err.code),
          },
        })
      },
      GEOLOCATION_OPTIONS,
    )
  })
}

/**
 * Returns a mock GPS coordinate for demo/testing purposes when the device
 * has no GPS or is running in a browser without location access.
 * Defaults to KL City Centre.
 */
export function getMockPosition(): GpsCoordinates {
  return { lat: 3.1478, lng: 101.7001 }
}

/**
 * Checks whether the browser supports geolocation at all.
 * Use this to conditionally render the "Use my location" button.
 */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function mapGeolocationErrorCode(code: number): GeolocationErrorCode {
  switch (code) {
    case GeolocationPositionError.PERMISSION_DENIED:   return 'PERMISSION_DENIED'
    case GeolocationPositionError.POSITION_UNAVAILABLE: return 'POSITION_UNAVAILABLE'
    case GeolocationPositionError.TIMEOUT:             return 'TIMEOUT'
    default:                                           return 'POSITION_UNAVAILABLE'
  }
}

function mapGeolocationErrorMessage(code: number): string {
  switch (code) {
    case GeolocationPositionError.PERMISSION_DENIED:
      return 'Location access was denied. Please allow location access and try again.'
    case GeolocationPositionError.POSITION_UNAVAILABLE:
      return 'Your location could not be determined. Please enter coordinates manually.'
    case GeolocationPositionError.TIMEOUT:
      return 'Location request timed out. Please try again or enter coordinates manually.'
    default:
      return 'An unknown location error occurred.'
  }
}