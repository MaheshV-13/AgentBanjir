import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SeverityBadge from '@/components/signal/SeverityBadge'

describe('SeverityBadge', () => {
  it('renders High with correct aria-label', () => {
    render(<SeverityBadge severity="High" />)
    expect(screen.getByLabelText('Severity: High')).toBeInTheDocument()
  })

  it('renders Medium with correct aria-label', () => {
    render(<SeverityBadge severity="Medium" />)
    expect(screen.getByLabelText('Severity: Medium')).toBeInTheDocument()
  })

  it('renders Low with correct aria-label', () => {
    render(<SeverityBadge severity="Low" />)
    expect(screen.getByLabelText('Severity: Low')).toBeInTheDocument()
  })

  it('renders the severity text', () => {
    render(<SeverityBadge severity="High" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })
})