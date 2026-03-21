import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MessageTextarea  from 'src/components/form/MessageTextarea'
import VerifiedToggle   from 'src/components/form/VerifiedToggle'
import NeedsChipList    from 'src/components/signal/NeedsChipList'
import ConfidenceBar    from 'src/components/signal/ConfidenceBar'
import StatusBadge      from 'src/components/signal/StatusBadge'
import CoordinatesTag   from 'src/components/signal/CoordinatesTag'

// ── MessageTextarea ───────────────────────────────────────────────────────────

describe('MessageTextarea', () => {
  it('renders textarea with placeholder', () => {
    render(<MessageTextarea value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows character count', () => {
    render(<MessageTextarea value="Hello" onChange={vi.fn()} />)
    expect(screen.getByText('495')).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    const onChange = vi.fn()
    render(<MessageTextarea value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test message' } })
    expect(onChange).toHaveBeenCalledWith('Test message')
  })

  it('shows error message when error prop is set', () => {
    render(<MessageTextarea value="" onChange={vi.fn()} error="Message is required" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Message is required')
  })

  it('shows amber counter when near limit', () => {
    const longMsg = 'a'.repeat(455)
    render(<MessageTextarea value={longMsg} onChange={vi.fn()} />)
    const counter = screen.getByText('45')
    expect(counter).toBeInTheDocument()
  })
})

// ── VerifiedToggle ────────────────────────────────────────────────────────────

describe('VerifiedToggle', () => {
  it('renders with role="switch"', () => {
    render(<VerifiedToggle value={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('aria-checked is false when value is false', () => {
    render(<VerifiedToggle value={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('aria-checked is true when value is true', () => {
    render(<VerifiedToggle value={true} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with toggled value on click', () => {
    const onChange = vi.fn()
    render(<VerifiedToggle value={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('calls onChange with false when toggling off', () => {
    const onChange = vi.fn()
    render(<VerifiedToggle value={true} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)
  })
})

// ── NeedsChipList ─────────────────────────────────────────────────────────────

describe('NeedsChipList', () => {
  it('renders formatted need chips', () => {
    render(<NeedsChipList needs={['rescue_boat', 'medical']} />)
    expect(screen.getByText('Rescue Boat')).toBeInTheDocument()
    expect(screen.getByText('Medical')).toBeInTheDocument()
  })

  it('shows overflow chip when needs exceed maxVisible', () => {
    render(<NeedsChipList needs={['a', 'b', 'c', 'd', 'e']} maxVisible={3} />)
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('shows empty state when needs array is empty', () => {
    render(<NeedsChipList needs={[]} />)
    expect(screen.getByText(/No specific needs listed/i)).toBeInTheDocument()
  })

  it('does not show overflow chip when needs fit within maxVisible', () => {
    render(<NeedsChipList needs={['rescue_boat', 'medical']} maxVisible={4} />)
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument()
  })
})

// ── ConfidenceBar ─────────────────────────────────────────────────────────────

describe('ConfidenceBar', () => {
  it('renders with correct role and aria attributes', () => {
    render(<ConfidenceBar score={80} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '80')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('displays the score percentage', () => {
    render(<ConfidenceBar score={75} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('clamps score above 100 to 100', () => {
    render(<ConfidenceBar score={150} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('clamps score below 0 to 0', () => {
    render(<ConfidenceBar score={-10} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

// ── StatusBadge ───────────────────────────────────────────────────────────────

describe('StatusBadge', () => {
  it('renders Pending Review for Pending_Human_Review', () => {
    render(<StatusBadge status="Pending_Human_Review" />)
    expect(screen.getByText('Pending Review')).toBeInTheDocument()
  })

  it('renders Dispatched', () => {
    render(<StatusBadge status="Dispatched" />)
    expect(screen.getByText('Dispatched')).toBeInTheDocument()
  })

  it('renders Rejected', () => {
    render(<StatusBadge status="Rejected" />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('has aria-label with status text', () => {
    render(<StatusBadge status="Dispatched" />)
    expect(screen.getByLabelText(/Status: Dispatched/i)).toBeInTheDocument()
  })
})

// ── CoordinatesTag ────────────────────────────────────────────────────────────

describe('CoordinatesTag', () => {
  it('renders coordinates to 4 decimal places', () => {
    render(<CoordinatesTag coords={{ lat: 3.1478, lng: 101.7001 }} />)
    expect(screen.getByText(/3\.1478/)).toBeInTheDocument()
    expect(screen.getByText(/101\.7001/)).toBeInTheDocument()
  })

  it('has descriptive aria-label', () => {
    render(<CoordinatesTag coords={{ lat: 3.1478, lng: 101.7001 }} />)
    expect(screen.getByLabelText(/GPS coordinates/i)).toBeInTheDocument()
  })
})