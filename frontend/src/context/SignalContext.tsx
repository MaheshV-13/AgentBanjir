import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react'
import {
  signalReducer,
  initialState,
  type SignalState,
  type SignalAction,
} from './signalReducer'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — Signal Context
//
// Provides global signal state and dispatch to the entire component tree.
// Wrap the app root with <SignalProvider> — all child components can then
// call useSignalContext() to read state or dispatch actions.
//
// State shape and reducer logic live in signalReducer.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalContextValue {
  state:    SignalState
  dispatch: Dispatch<SignalAction>
}

const SignalContext = createContext<SignalContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function SignalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(signalReducer, initialState)

  return (
    <SignalContext.Provider value={{ state, dispatch }}>
      {children}
    </SignalContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * Access global signal state and dispatch from any component.
 *
 * @example
 *   const { state, dispatch } = useSignalContext()
 *   const highSignals = state.filteredSignals.filter(s => s.severity_level === 'High')
 *   dispatch({ type: 'SET_FILTER', payload: 'High' })
 */
export function useSignalContext(): SignalContextValue {
  const ctx = useContext(SignalContext)
  if (!ctx) {
    throw new Error('useSignalContext must be used within a <SignalProvider>')
  }
  return ctx
}

// Re-export state types so consumers don't need to import from two files
export type { SignalState, SignalAction }