import { useRef, useState } from 'react'
import { Upload, X, Image } from 'lucide-react'
import { fileToBase64 } from '@/utils/base64Converter'

// ─────────────────────────────────────────────────────────────────────────────
// ImageUploadField — file picker that converts to Base64 data-URI
//
// Image is optional in the demo form. A preview thumbnail is shown once
// a file is selected. The "×" button clears the selection.
// ─────────────────────────────────────────────────────────────────────────────

interface ImageUploadFieldProps {
  value:    string   // base64 data-URI or ''
  onChange: (dataUri: string) => void
  error?:   string
}

export default function ImageUploadField({ value, onChange, error }: ImageUploadFieldProps) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [convErr, setConvErr] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setConvErr(null)
    const result = await fileToBase64(file)
    setLoading(false)

    if (result.success) {
      onChange(result.dataUri)
    } else {
      setConvErr(result.error)
    }
    // Reset input so the same file can be re-selected after clearing
    e.target.value = ''
  }

  const handleClear = () => {
    onChange('')
    setConvErr(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
        <Image aria-hidden="true" style={{ width: 13, height: 13 }} />
        Photo
        <span className="text-slate-600 font-normal">(optional)</span>
      </label>

      {value ? (
        /* Preview + clear */
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt="Uploaded preview"
            className="w-16 h-16 object-cover rounded-md border border-[#30363d]"
          />
          <div className="flex flex-col gap-1">
            <p className="text-xs text-slate-400">Image attached</p>
            <button
              type="button"
              onClick={handleClear}
              className="
                flex items-center gap-1 text-xs text-red-400
                hover:text-red-300 transition-colors
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500
              "
            >
              <X aria-hidden="true" style={{ width: 12, height: 12 }} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone / click to upload */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="
            flex flex-col items-center justify-center gap-1.5
            w-full py-4 rounded-md
            border border-dashed border-[#30363d]
            text-slate-600 text-xs
            hover:border-slate-500 hover:text-slate-400
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
          "
          aria-label="Upload photo"
        >
          <Upload aria-hidden="true" style={{ width: 16, height: 16 }} />
          {loading ? 'Processing…' : 'Click to upload photo'}
          <span className="text-slate-700">JPEG, PNG, WebP — max 5 MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {(convErr || error) && (
        <p className="text-xs text-red-400" role="alert">
          {convErr ?? error}
        </p>
      )}
    </div>
  )
}