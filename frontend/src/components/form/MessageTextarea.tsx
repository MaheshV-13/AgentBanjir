import { MessageSquare } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// MessageTextarea — raw_message input with live character counter
// Max 500 chars as per MasterInputSignalSchema.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CHARS = 500

interface MessageTextareaProps {
  value:    string
  onChange: (value: string) => void
  error?:   string
}

export default function MessageTextarea({ value, onChange, error }: MessageTextareaProps) {
  const remaining = MAX_CHARS - value.length
  const isNearLimit = remaining <= 50

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="raw-message"
        className="text-xs font-medium text-slate-400 flex items-center gap-1.5"
      >
        <MessageSquare aria-hidden="true" style={{ width: 13, height: 13 }} />
        Distress message
        <span className="text-red-500" aria-hidden="true">*</span>
      </label>

      <textarea
        id="raw-message"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={MAX_CHARS}
        rows={3}
        placeholder="Describe the emergency situation…"
        aria-required="true"
        aria-describedby="message-counter"
        className={`
          w-full px-3 py-2 rounded-md text-sm
          bg-[#21262d] text-slate-300
          placeholder:text-slate-600
          border transition-colors duration-150 resize-none
          focus:outline-none focus:ring-1
          ${error
            ? 'border-red-600/60 focus:border-red-500 focus:ring-red-500'
            : 'border-[#30363d] focus:border-brand focus:ring-brand'
          }
        `}
      />

      <div className="flex items-center justify-between">
        {error
          ? <p className="text-xs text-red-400" role="alert">{error}</p>
          : <span />
        }
        <span
          id="message-counter"
          className={`text-xs font-mono ml-auto ${
            isNearLimit ? 'text-amber-500' : 'text-slate-600'
          }`}
          aria-live="polite"
          aria-label={`${remaining} characters remaining`}
        >
          {remaining}
        </span>
      </div>
    </div>
  )
}