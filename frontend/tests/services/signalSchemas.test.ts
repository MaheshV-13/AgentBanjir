import { describe, it, expect } from 'vitest'
import {
  GpsCoordinatesSchema,
  SeverityLevelSchema,
  SignalStatusSchema,
  EnrichedSignalSchema,
  SignalListResponseSchema,
  MasterInputSignalSchema,
  StatusUpdatePayloadSchema,
  parseSignalListResponse,
  parseEnrichedSignal,
  validateMasterInput,
} from '@/schemas/signalSchemas'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_SIGNAL = {
  id: 'sig-001',
  gps_coordinates: { lat: 3.1478, lng: 101.7001 },
  severity_level: 'High',
  ai_confidence_score: 92,
  specific_needs: ['rescue_boat', 'medical'],
  status: 'Pending_Human_Review',
  created_at: '2026-03-15T08:30:00+08:00',
  raw_message: 'Air banjir sudah masuk rumah',
}

const VALID_INPUT = {
  gps_coordinates: { lat: 3.1478, lng: 101.7001 },
  image_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  raw_message: 'Help needed urgently',
  simulated_user_verified: true,
}

// ── GpsCoordinatesSchema ──────────────────────────────────────────────────────

describe('GpsCoordinatesSchema', () => {
  it('accepts valid Malaysian coordinates', () => {
    expect(GpsCoordinatesSchema.safeParse({ lat: 3.1478, lng: 101.7001 }).success).toBe(true)
  })

  it('rejects lat > 90', () => {
    expect(GpsCoordinatesSchema.safeParse({ lat: 91, lng: 101 }).success).toBe(false)
  })

  it('rejects lng > 180', () => {
    expect(GpsCoordinatesSchema.safeParse({ lat: 3, lng: 181 }).success).toBe(false)
  })

  it('rejects non-finite values', () => {
    expect(GpsCoordinatesSchema.safeParse({ lat: Infinity, lng: 101 }).success).toBe(false)
    expect(GpsCoordinatesSchema.safeParse({ lat: NaN, lng: 101 }).success).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(GpsCoordinatesSchema.safeParse({ lat: 3.1 }).success).toBe(false)
    expect(GpsCoordinatesSchema.safeParse({}).success).toBe(false)
  })
})

// ── Enum schemas ──────────────────────────────────────────────────────────────

describe('SeverityLevelSchema', () => {
  it('accepts all valid levels', () => {
    expect(SeverityLevelSchema.safeParse('Low').success).toBe(true)
    expect(SeverityLevelSchema.safeParse('Medium').success).toBe(true)
    expect(SeverityLevelSchema.safeParse('High').success).toBe(true)
  })

  it('rejects lowercase variants', () => {
    expect(SeverityLevelSchema.safeParse('high').success).toBe(false)
    expect(SeverityLevelSchema.safeParse('MEDIUM').success).toBe(false)
  })

  it('rejects unknown strings', () => {
    expect(SeverityLevelSchema.safeParse('Critical').success).toBe(false)
    expect(SeverityLevelSchema.safeParse('').success).toBe(false)
  })
})

describe('SignalStatusSchema', () => {
  it('accepts all valid statuses', () => {
    expect(SignalStatusSchema.safeParse('Pending_Human_Review').success).toBe(true)
    expect(SignalStatusSchema.safeParse('Dispatched').success).toBe(true)
    expect(SignalStatusSchema.safeParse('Rejected').success).toBe(true)
  })

  it('rejects unknown status strings', () => {
    expect(SignalStatusSchema.safeParse('Pending').success).toBe(false)
    expect(SignalStatusSchema.safeParse('pending_human_review').success).toBe(false)
  })
})

// ── EnrichedSignalSchema ──────────────────────────────────────────────────────

describe('EnrichedSignalSchema', () => {
  it('parses a fully-valid signal', () => {
    const result = EnrichedSignalSchema.safeParse(VALID_SIGNAL)
    expect(result.success).toBe(true)
  })

  it('accepts signal without optional fields', () => {
    const { created_at, raw_message, ...minimal } = VALID_SIGNAL
    expect(EnrichedSignalSchema.safeParse(minimal).success).toBe(true)
  })

  it('normalises float confidence score to integer', () => {
    const result = EnrichedSignalSchema.safeParse({
      ...VALID_SIGNAL,
      ai_confidence_score: 87.6,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.ai_confidence_score).toBe(88)
  })

  it('rejects confidence score above 100', () => {
    expect(
      EnrichedSignalSchema.safeParse({ ...VALID_SIGNAL, ai_confidence_score: 101 }).success,
    ).toBe(false)
  })

  it('rejects confidence score below 0', () => {
    expect(
      EnrichedSignalSchema.safeParse({ ...VALID_SIGNAL, ai_confidence_score: -1 }).success,
    ).toBe(false)
  })

  it('defaults specific_needs to empty array when omitted', () => {
    const { specific_needs, ...noNeeds } = VALID_SIGNAL
    const result = EnrichedSignalSchema.safeParse(noNeeds)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.specific_needs).toEqual([])
  })

  it('rejects empty id string', () => {
    expect(
      EnrichedSignalSchema.safeParse({ ...VALID_SIGNAL, id: '' }).success,
    ).toBe(false)
  })

  it('rejects invalid severity_level', () => {
    expect(
      EnrichedSignalSchema.safeParse({ ...VALID_SIGNAL, severity_level: 'Critical' }).success,
    ).toBe(false)
  })

  it('accepts ISO-8601 datetime with UTC offset', () => {
    const result = EnrichedSignalSchema.safeParse({
      ...VALID_SIGNAL,
      created_at: '2026-03-15T00:30:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects malformed created_at', () => {
    expect(
      EnrichedSignalSchema.safeParse({ ...VALID_SIGNAL, created_at: '15-03-2026' }).success,
    ).toBe(false)
  })
})

// ── SignalListResponseSchema ──────────────────────────────────────────────────

describe('SignalListResponseSchema', () => {
  it('parses wrapped envelope { signals: [...] }', () => {
    const result = SignalListResponseSchema.safeParse({ signals: [VALID_SIGNAL] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.signals).toHaveLength(1)
  })

  it('parses bare array fallback', () => {
    const result = SignalListResponseSchema.safeParse([VALID_SIGNAL])
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.signals).toHaveLength(1)
  })

  it('parses empty signals array', () => {
    const result = SignalListResponseSchema.safeParse({ signals: [] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.signals).toHaveLength(0)
  })

  it('rejects invalid signal inside array', () => {
    const bad = { ...VALID_SIGNAL, severity_level: 'Unknown' }
    expect(SignalListResponseSchema.safeParse({ signals: [bad] }).success).toBe(false)
  })
})

// ── MasterInputSignalSchema ───────────────────────────────────────────────────

describe('MasterInputSignalSchema', () => {
  it('parses a valid submission', () => {
    expect(MasterInputSignalSchema.safeParse(VALID_INPUT).success).toBe(true)
  })

  it('defaults image_base64 to empty string when omitted', () => {
    const { image_base64, ...noImg } = VALID_INPUT
    const result = MasterInputSignalSchema.safeParse(noImg)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.image_base64).toBe('')
  })

  it('defaults simulated_user_verified to false when omitted', () => {
    const { simulated_user_verified, ...noVerified } = VALID_INPUT
    const result = MasterInputSignalSchema.safeParse(noVerified)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.simulated_user_verified).toBe(false)
  })

  it('rejects empty raw_message', () => {
    expect(
      MasterInputSignalSchema.safeParse({ ...VALID_INPUT, raw_message: '' }).success,
    ).toBe(false)
  })

  it('rejects raw_message over 500 chars', () => {
    expect(
      MasterInputSignalSchema.safeParse({
        ...VALID_INPUT,
        raw_message: 'a'.repeat(501),
      }).success,
    ).toBe(false)
  })

  it('rejects invalid image_base64 prefix', () => {
    expect(
      MasterInputSignalSchema.safeParse({
        ...VALID_INPUT,
        image_base64: 'notavalidprefix',
      }).success,
    ).toBe(false)
  })

  it('accepts empty string for image_base64', () => {
    expect(
      MasterInputSignalSchema.safeParse({ ...VALID_INPUT, image_base64: '' }).success,
    ).toBe(true)
  })

  it('trims whitespace from raw_message', () => {
    const result = MasterInputSignalSchema.safeParse({
      ...VALID_INPUT,
      raw_message: '  Help needed  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.raw_message).toBe('Help needed')
  })
})

// ── StatusUpdatePayloadSchema ─────────────────────────────────────────────────

describe('StatusUpdatePayloadSchema', () => {
  it('accepts Dispatched', () => {
    expect(StatusUpdatePayloadSchema.safeParse({ status: 'Dispatched' }).success).toBe(true)
  })

  it('accepts Rejected', () => {
    expect(StatusUpdatePayloadSchema.safeParse({ status: 'Rejected' }).success).toBe(true)
  })

  it('rejects Pending_Human_Review (operators cannot patch to Pending)', () => {
    expect(
      StatusUpdatePayloadSchema.safeParse({ status: 'Pending_Human_Review' }).success,
    ).toBe(false)
  })
})

// ── Helper functions ──────────────────────────────────────────────────────────

describe('parseSignalListResponse', () => {
  it('returns success: true for valid data', () => {
    const result = parseSignalListResponse({ signals: [VALID_SIGNAL] })
    expect(result.success).toBe(true)
  })

  it('returns fallback empty list for invalid data', () => {
    const result = parseSignalListResponse({ garbage: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.fallback).toEqual({ signals: [] })
  })

  it('returns fallback for null input', () => {
    const result = parseSignalListResponse(null)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.fallback.signals).toHaveLength(0)
  })
})

describe('parseEnrichedSignal', () => {
  it('returns success: true for valid signal', () => {
    expect(parseEnrichedSignal(VALID_SIGNAL).success).toBe(true)
  })

  it('returns success: false with error for invalid signal', () => {
    const result = parseEnrichedSignal({ id: '', status: 'Unknown' })
    expect(result.success).toBe(false)
  })
})

describe('validateMasterInput', () => {
  it('returns valid: true for good input', () => {
    expect(validateMasterInput(VALID_INPUT).valid).toBe(true)
  })

  it('returns field-level errors for bad input', () => {
    const result = validateMasterInput({
      ...VALID_INPUT,
      raw_message: '',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.fieldErrors.raw_message).toBeDefined()
    }
  })

  it('surfaces gps_coordinates error correctly', () => {
    const result = validateMasterInput({
      ...VALID_INPUT,
      gps_coordinates: { lat: 999, lng: 101 },
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.fieldErrors.gps_coordinates).toBeDefined()
    }
  })
})