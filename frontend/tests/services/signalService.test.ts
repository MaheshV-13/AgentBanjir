import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { fetchSignals, submitSignal, updateSignalStatus, extractErrorMessage, isNetworkError } from '@/services/signalService'
import apiClient from '@/services/apiClient'

// ── Mock axios ────────────────────────────────────────────────────────────────

vi.mock('@/services/apiClient', () => ({
  default: {
    get:   vi.fn(),
    post:  vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request:  { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

const mockGet   = vi.mocked(apiClient.get)
const mockPost  = vi.mocked(apiClient.post)
const mockPatch = vi.mocked(apiClient.patch)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_SIGNAL = {
  id: 'sig-001',
  gps_coordinates: { lat: 3.1478, lng: 101.7001 },
  severity_level: 'High',
  ai_confidence_score: 92,
  specific_needs: ['rescue_boat'],
  status: 'Pending_Human_Review',
  created_at: '2026-03-15T08:30:00+08:00',
}

const VALID_INPUT = {
  gps_coordinates: { lat: 3.1478, lng: 101.7001 },
  image_base64: '',
  raw_message: 'Help needed urgently',
  simulated_user_verified: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── fetchSignals ──────────────────────────────────────────────────────────────

describe('fetchSignals', () => {
  it('returns signals array from wrapped envelope', async () => {
    mockGet.mockResolvedValueOnce({ data: { signals: [VALID_SIGNAL] } })
    const result = await fetchSignals()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('sig-001')
  })

  it('returns signals array from bare array response', async () => {
    mockGet.mockResolvedValueOnce({ data: [VALID_SIGNAL] })
    const result = await fetchSignals()
    expect(result).toHaveLength(1)
  })

  it('returns empty array when response fails Zod validation', async () => {
    mockGet.mockResolvedValueOnce({ data: { unexpected: true } })
    const result = await fetchSignals()
    expect(result).toEqual([])
  })

  it('throws when the HTTP request fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'))
    await expect(fetchSignals()).rejects.toThrow('Network Error')
  })

  it('normalises float confidence score to integer', async () => {
    mockGet.mockResolvedValueOnce({
      data: { signals: [{ ...VALID_SIGNAL, ai_confidence_score: 87.6 }] },
    })
    const result = await fetchSignals()
    expect(result[0].ai_confidence_score).toBe(88)
  })
})

// ── submitSignal ──────────────────────────────────────────────────────────────

describe('submitSignal', () => {
  it('returns enriched signal on success', async () => {
    mockPost.mockResolvedValueOnce({ data: VALID_SIGNAL })
    const result = await submitSignal(VALID_INPUT)
    expect(result.id).toBe('sig-001')
  })

  it('throws when response fails Zod validation', async () => {
    mockPost.mockResolvedValueOnce({ data: { bad: 'response' } })
    await expect(submitSignal(VALID_INPUT)).rejects.toThrow(
      'unexpected response format',
    )
  })

  it('throws when HTTP request fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('500 Internal Server Error'))
    await expect(submitSignal(VALID_INPUT)).rejects.toThrow()
  })
})

// ── updateSignalStatus ────────────────────────────────────────────────────────

describe('updateSignalStatus', () => {
  it('returns updated signal on success', async () => {
    const dispatched = { ...VALID_SIGNAL, status: 'Dispatched' }
    mockPatch.mockResolvedValueOnce({ data: dispatched })
    const result = await updateSignalStatus('sig-001', { status: 'Dispatched' })
    expect(result.status).toBe('Dispatched')
  })

  it('calls the correct endpoint', async () => {
    mockPatch.mockResolvedValueOnce({ data: { ...VALID_SIGNAL, status: 'Rejected' } })
    await updateSignalStatus('sig-001', { status: 'Rejected' })
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/signals/sig-001/status', { status: 'Rejected' })
  })

  it('throws when response fails Zod validation', async () => {
    mockPatch.mockResolvedValueOnce({ data: { garbage: true } })
    await expect(updateSignalStatus('sig-001', { status: 'Dispatched' })).rejects.toThrow()
  })

  it('throws when HTTP request fails', async () => {
    mockPatch.mockRejectedValueOnce(new Error('404 Not Found'))
    await expect(updateSignalStatus('sig-001', { status: 'Dispatched' })).rejects.toThrow()
  })
})

// ── extractErrorMessage ───────────────────────────────────────────────────────

describe('extractErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(extractErrorMessage(new Error('something went wrong'))).toBe('something went wrong')
  })

  it('returns string errors directly', () => {
    expect(extractErrorMessage('plain string error')).toBe('plain string error')
  })

  it('returns fallback for unknown error shapes', () => {
    expect(extractErrorMessage({ code: 500 })).toBe('An unexpected error occurred.')
    expect(extractErrorMessage(null)).toBe('An unexpected error occurred.')
  })
})

// ── isNetworkError ────────────────────────────────────────────────────────────

describe('isNetworkError', () => {
  it('returns true for axios error with no response', () => {
    const err = new axios.AxiosError('Network Error')
    expect(isNetworkError(err)).toBe(true)
  })

  it('returns false for a regular Error', () => {
    expect(isNetworkError(new Error('Server error'))).toBe(false)
  })

  it('returns false for non-error values', () => {
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError('string')).toBe(false)
  })
})