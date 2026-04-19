// ─────────────────────────────────────────────────────────────────────────────
// base64Converter — converts a browser File object to a Base64 data-URI string
//
// Used by ImageUploadField to prepare image payloads for the Master Input Schema.
// Returns a typed result — never throws — so callers can handle errors inline.
// ─────────────────────────────────────────────────────────────────────────────

export type Base64Result =
  | { success: true;  dataUri: string; base64Data: string; sizeKb: number }
  | { success: false; error: string }

const MAX_SIZE_MB   = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Converts a File to a Base64 data-URI.
 * Validates file type and size before reading.
 */
export async function fileToBase64(file: File): Promise<Base64Result> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error:   `Unsupported file type: ${file.type}. Please upload a JPEG, PNG, WebP, or GIF.`,
    }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      success: false,
      error:   `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`,
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const dataUri = reader.result as string
      // Split off the prefix for the API payload
      const base64Data = dataUri.split(',')[1] || '' 
      
      resolve({
        success: true,
        dataUri,
        base64Data, // <-- Make sure your API call uses THIS property
        sizeKb: Math.round(file.size / 1024),
      })
    }

    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read the file. Please try again.' })
    }

    reader.readAsDataURL(file)
  })
}