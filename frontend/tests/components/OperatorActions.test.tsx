import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OperatorActions from 'src/components/signal/OperatorActions'
import type { EnrichedSignal } from 'src/types/signal.types'

const SIGNAL: EnrichedSignal = {
  id:                  'sig-001',
  gps_coordinates:     { lat: 3.14, lng: 101.7 },
  severity_level:      'High',
  ai_confidence_score: 90,
  specific_needs:      [],
  status:              'Pending_Human_Review',
}

const defaultProps = {
  signal:       SIGNAL,
  onConfirm:    vi.fn(),
  onReject:     vi.fn(),
  isUpdating:   false,
  actionError:  null,
  onClearError: vi.fn(),
}

describe('OperatorActions', () => {
  it('renders both buttons for Pending signal', () => {
    render(<OperatorActions {...defaultProps} />)
    expect(screen.getByLabelText(/Confirm dispatch/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Reject signal/i)).toBeInTheDocument()
  })

  it('renders nothing for Dispatched signal', () => {
    render(<OperatorActions {...defaultProps} signal={{ ...SIGNAL, status: 'Dispatched' }} />)
    expect(screen.queryByLabelText(/Confirm dispatch/i)).not.toBeInTheDocument()
  })

  it('renders nothing for Rejected signal', () => {
    render(<OperatorActions {...defaultProps} signal={{ ...SIGNAL, status: 'Rejected' }} />)
    expect(screen.queryByLabelText(/Confirm dispatch/i)).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(<OperatorActions {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByLabelText(/Confirm dispatch/i))
    expect(onConfirm).toHaveBeenCalledWith(SIGNAL)
  })

  it('calls onReject when reject button is clicked', () => {
    const onReject = vi.fn()
    render(<OperatorActions {...defaultProps} onReject={onReject} />)
    fireEvent.click(screen.getByLabelText(/Reject signal/i))
    expect(onReject).toHaveBeenCalledWith(SIGNAL)
  })

  it('disables both buttons when isUpdating is true', () => {
    render(<OperatorActions {...defaultProps} isUpdating={true} />)
    expect(screen.getByLabelText(/Confirm dispatch/i)).toBeDisabled()
    expect(screen.getByLabelText(/Reject signal/i)).toBeDisabled()
  })

  it('shows error message with role="alert"', () => {
    render(<OperatorActions {...defaultProps} actionError="Server unreachable" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Server unreachable')
  })

  it('calls onClearError when a button is clicked', () => {
    const onClearError = vi.fn()
    render(<OperatorActions {...defaultProps} onClearError={onClearError} />)
    fireEvent.click(screen.getByLabelText(/Confirm dispatch/i))
    expect(onClearError).toHaveBeenCalled()
  })
})