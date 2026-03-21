import { ShieldCheck, ShieldOff } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// VerifiedToggle — simulated_user_verified boolean toggle
//
// In the real system this would be set by the backend after SMS verification.
// For the hackathon demo it's a manual toggle so judges can see the difference
// between verified and unverified submissions in the enriched signal output.
// ─────────────────────────────────────────────────────────────────────────────

interface VerifiedToggleProps {
  value:    boolean
  onChange: (value: boolean) => void
}

export default function VerifiedToggle({ value, onChange }: VerifiedToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {value
          ? <ShieldCheck aria-hidden="true" style={{ width: 14, height: 14 }} className="text-green-400" />
          : <ShieldOff   aria-hidden="true" style={{ width: 14, height: 14 }} className="text-slate-600" />
        }
        <div>
          <p className="text-xs font-medium text-slate-400">
            Identity verified
          </p>
          <p className="text-xs text-slate-600">
            Simulated — toggles simulated_user_verified flag
          </p>
        </div>
      </div>

      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label="Toggle identity verification"
        onClick={() => onChange(!value)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 items-center rounded-full
          border-2 border-transparent transition-colors duration-200
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-brand focus-visible:ring-offset-2
          focus-visible:ring-offset-[#161b22]
          ${value ? 'bg-green-600' : 'bg-slate-700'}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            inline-block h-3.5 w-3.5 rounded-full bg-white shadow
            transition-transform duration-200
            ${value ? 'translate-x-4' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  )
}