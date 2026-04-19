import { useState } from 'react'
import { SignalProvider }     from '@/context/SignalContext'
import AppHeader              from '@/components/layout/AppHeader'
import DashboardLayout        from '@/components/layout/DashboardLayout'
import StatsBar               from '@/components/layout/StatsBar'
import SignalSubmissionForm   from '@/components/form/SignalSubmissionForm'

/**
 * App — root component. All phases complete.
 *
 * WCAG 2.4.1 — skip-nav link allows keyboard users to bypass the header
 * and jump directly to the main content region.
 */
export default function App() {
  const [view, setView] = useState<'victim' | 'dispatcher'>('dispatcher')

  const handleSwitchToDispatcher = () => setView('dispatcher')

  return (
    <SignalProvider>
      {/* WCAG 2.4.1 — Bypass Blocks: visible on focus, hidden otherwise */}
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      <div className="flex flex-col h-screen bg-[#0d1117] text-slate-200 overflow-hidden">

        <AppHeader view={view} onViewChange={setView} />

        <main
          id="main-content"
          className={
            view === 'victim'
              ? 'flex-1 min-h-0 overflow-y-auto'
              : 'flex-1 min-h-0 overflow-hidden'
          }
          aria-label="Command center dashboard"
          tabIndex={-1}
        >
          {view === 'dispatcher' ? (
            <DashboardLayout />
          ) : (
            <SignalSubmissionForm onSwitchToDispatcher={handleSwitchToDispatcher} />
          )}
        </main>

        {view === 'dispatcher' && <StatsBar />}

      </div>
    </SignalProvider>
  )
}