import { useState } from 'react'
import { ChevronUp, ChevronDown, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSignalContext }    from '@/context/SignalContext'
import { submitSignal }        from '@/services/signalService'
import { validateMasterInput } from '@/schemas/signalSchemas'
import type { GpsCoordinates } from '@/types/signal.types'
import GpsCoordinatesField     from './GpsCoordinatesField'
import ImageUploadField        from './ImageUploadField'
import MessageTextarea         from './MessageTextarea'
import VerifiedToggle          from './VerifiedToggle'

// ─────────────────────────────────────────────────────────────────────────────
// SignalSubmissionForm — mock victim signal submission panel (Q2: collapsible)
//
// Simulates the victim-side mobile app for hackathon demo purposes.
// Collapsed by default — operators expand it to demo a new signal submission.
//
// On submit:
//   1. Validates with MasterInputSignalSchema (Zod)
//   2. POST /api/v1/analyze-signal
//   3. Upserts the returned EnrichedSignal into the feed via UPSERT_SIGNAL
//   4. Shows success state, then resets after 3 seconds
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  gps_coordinates:         GpsCoordinates | null
  image_base64:            string
  raw_message:             string
  simulated_user_verified: boolean
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

const EMPTY_FORM: FormState = {
  gps_coordinates:         null,
  image_base64:            '',
  raw_message:             '',
  simulated_user_verified: false,
}

export default function SignalSubmissionForm() {
  const { dispatch } = useSignalContext()
  const [isOpen,       setIsOpen      ] = useState(false)
  const [form,         setForm        ] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors,  setFieldErrors ] = useState<Partial<Record<string, string>>>({})
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [submitError,  setSubmitError ] = useState<string | null>(null)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    // Clear field error on change
    if (fieldErrors[key]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setFieldErrors({})

    // Build payload — use (0,0) as placeholder if GPS not yet set, Zod will catch it
    const payload = {
      gps_coordinates:         form.gps_coordinates ?? { lat: 0, lng: 0 },
      image_base64:            form.image_base64,
      raw_message:             form.raw_message,
      simulated_user_verified: form.simulated_user_verified,
    }

    // Client-side validation
    const validation = validateMasterInput(payload)
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors as Record<string, string>)
      return
    }

    // GPS specifically validated after Zod (gives a friendlier message)
    if (!form.gps_coordinates) {
      setFieldErrors({ gps_coordinates: 'Please provide GPS coordinates before submitting.' })
      return
    }

    setSubmitStatus('submitting')

    try {
      const enriched = await submitSignal(validation.data)

      // Upsert into feed immediately — no need to wait for next poll
      dispatch({ type: 'UPSERT_SIGNAL', payload: enriched })
      setSubmitStatus('success')

      // Reset form after 3s, keep panel open for demo
      setTimeout(() => {
        setForm(EMPTY_FORM)
        setSubmitStatus('idle')
      }, 3000)

    } catch (err) {
      setSubmitStatus('error')
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    }
  }

  const handleReset = () => {
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setSubmitStatus('idle')
    setSubmitError(null)
  }

  return (
    <div className="shrink-0 bg-[#161b22] border-t border-[#30363d]">

      {/* ── Collapse toggle ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        aria-controls="submission-form-body"
        className="
          w-full flex items-center justify-between
          px-5 py-2.5
          text-xs font-medium text-slate-500
          hover:text-slate-300 hover:bg-[#21262d]
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-inset
          focus-visible:ring-2 focus-visible:ring-brand
        "
      >
        <span className="flex items-center gap-2">
          <Send aria-hidden="true" style={{ width: 13, height: 13 }} />
          Mock victim signal submission
          <span className="text-slate-700">(demo panel)</span>
        </span>
        {isOpen
          ? <ChevronDown aria-hidden="true" style={{ width: 14, height: 14 }} />
          : <ChevronUp   aria-hidden="true" style={{ width: 14, height: 14 }} />
        }
      </button>

      {/* ── Form body ────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          id="submission-form-body"
          className="px-5 pb-5 pt-1 animate-panel-open"
        >
          {submitStatus === 'success' ? (
            /* Success state */
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <CheckCircle2
                aria-hidden="true"
                style={{ width: 32, height: 32 }}
                className="text-green-400"
              />
              <p className="text-sm font-medium text-green-400">Signal submitted successfully</p>
              <p className="text-xs text-slate-600">
                The enriched signal has been added to the feed. Resetting in 3 seconds…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                {/* GPS field */}
                <GpsCoordinatesField
                  value={form.gps_coordinates}
                  onChange={v => setField('gps_coordinates', v)}
                  error={fieldErrors.gps_coordinates}
                />

                {/* Image upload */}
                <ImageUploadField
                  value={form.image_base64}
                  onChange={v => setField('image_base64', v)}
                  error={fieldErrors.image_base64}
                />
              </div>

              {/* Message textarea */}
              <div className="mb-4">
                <MessageTextarea
                  value={form.raw_message}
                  onChange={v => setField('raw_message', v)}
                  error={fieldErrors.raw_message}
                />
              </div>

              {/* Verified toggle */}
              <div className="mb-4 px-3 py-2.5 bg-[#21262d] rounded-md border border-[#30363d]">
                <VerifiedToggle
                  value={form.simulated_user_verified}
                  onChange={v => setField('simulated_user_verified', v)}
                />
              </div>

              {/* Submit error */}
              {submitStatus === 'error' && submitError && (
                <div
                  role="alert"
                  className="
                    flex items-start gap-2 mb-4 px-3 py-2.5 rounded-md
                    bg-red-900/20 border border-red-800/40
                  "
                >
                  <AlertCircle
                    aria-hidden="true"
                    style={{ width: 14, height: 14 }}
                    className="text-red-400 shrink-0 mt-0.5"
                  />
                  <p className="text-xs text-red-400">{submitError}</p>
                </div>
              )}

              {/* Submit + Reset buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleReset}
                  className="
                    px-4 py-2 rounded-md text-xs font-medium
                    bg-transparent text-slate-500 border border-slate-700
                    hover:text-slate-300 hover:border-slate-500
                    transition-colors duration-150
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500
                  "
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={submitStatus === 'submitting'}
                  className="
                    flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium
                    bg-brand text-white
                    hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-150
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                    focus-visible:ring-offset-2 focus-visible:ring-offset-[#161b22]
                  "
                >
                  {submitStatus === 'submitting'
                    ? <><Loader2 aria-hidden="true" style={{ width: 13, height: 13 }} className="animate-spin" /> Submitting…</>
                    : <><Send    aria-hidden="true" style={{ width: 13, height: 13 }} /> Submit Signal</>
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}