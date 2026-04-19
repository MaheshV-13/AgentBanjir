import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SignalCard from '@/components/feed/SignalCard'
import type { EnrichedSignal } from '@/types/signal.types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_SIGNAL: EnrichedSignal = {
  id:                  'sig-abc-001',
  gps_coordinates:     { lat: 3.1478, lng: 101.7001 },
  severity_level:      'High',
  ai_confidence_score: 92,
  specific_needs:      ['rescue_boat', 'medical'],
  status:              'Pending_Human_Review',
  created_at:          '2026-03-15T08:30:00+08:00',
  raw_message:         'Air banjir dah masuk rumah, tolong!',
}

const defaultProps = {
  signal:      BASE_SIGNAL,
  onConfirm:   vi.fn(),
  onReject:    vi.fn(),
  onClearError: vi.fn(),
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('SignalCard — rendering', () => {
  it('renders severity badge', () => {
    render(<SignalCard {...defaultProps} />)
    expect(screen.getByLabelText(/Severity: High/i)).toBeInTheDocument()
  })

  it('renders status badge', () => {
    render(<SignalCard {...defaultProps} />)
    expect(screen.getByLabelText(/Status: Pending Review/i)).toBeInTheDocument()
  })  

  it('renders coordinates', () => {
    render(<SignalCard {...defaultProps} />)
    expect(screen.getByLabelText(/GPS coordinates/i)).toBeInTheDocument()
  })

  it('renders confidence bar', () => {
    render(<SignalCard {...defaultProps} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders needs chips', () => {
    render(<SignalCard {...defaultProps} />)
    expect(screen.getByText('Rescue Boat')).toBeInTheDocument()
    expect(screen.getByText('Medical')).toBeInTheDocument()
  })

  it('renders operator action buttons for Pending signal', () => {
    render(<SignalCard {...defaultProps} />)
    expect(screen.getByLabelText(/Confirm dispatch/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Reject signal/i)).toBeInTheDocument()
  })

  it('does not render action buttons for Dispatched signal', () => {
    render(<SignalCard {...defaultProps} signal={{ ...BASE_SIGNAL, status: 'Dispatched' }} />)
    expect(screen.queryByLabelText(/Confirm dispatch/i)).not.toBeInTheDocument()
  })

  it('does not render action buttons for Rejected signal', () => {
    render(<SignalCard {...defaultProps} signal={{ ...BASE_SIGNAL, status: 'Rejected' }} />)
    expect(screen.queryByLabelText(/Confirm dispatch/i)).not.toBeInTheDocument()
  })

  it('uses role="alert" for active High severity signals', () => {
    render(<SignalCard {...defaultProps} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('uses role="article" for non-High signals', () => {
    render(<SignalCard {...defaultProps} signal={{ ...BASE_SIGNAL, severity_level: 'Low' }} />)
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('shows "No specific needs listed" when needs array is empty', () => {
    render(<SignalCard {...defaultProps} signal={{ ...BASE_SIGNAL, specific_needs: [] }} />)
    expect(screen.getByText(/No specific needs listed/i)).toBeInTheDocument()
  })
})

// ── Interactions ──────────────────────────────────────────────────────────────

describe('SignalCard — interactions', () => {
  it('calls onConfirm with signal when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(<SignalCard {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByLabelText(/Confirm dispatch/i))
    expect(onConfirm).toHaveBeenCalledWith(BASE_SIGNAL)
  })

  it('calls onReject with signal when reject button clicked', () => {
    const onReject = vi.fn()
    render(<SignalCard {...defaultProps} onReject={onReject} />)
    fireEvent.click(screen.getByLabelText(/Reject signal/i))
    expect(onReject).toHaveBeenCalledWith(BASE_SIGNAL)
  })

  it('disables buttons when isUpdating is true', () => {
    render(<SignalCard {...defaultProps} isUpdating={true} />)
    expect(screen.getByLabelText(/Confirm dispatch/i)).toBeDisabled()
    expect(screen.getByLabelText(/Reject signal/i)).toBeDisabled()
  })
})