import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fileToBase64 } from '@/utils/base64Converter'

// ── FileReader mock ───────────────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Array(sizeBytes).fill('a').join('')
  return new File([content], name, { type })
}

function mockFileReaderSuccess(dataUri: string) {
  const mockReader = {
    result: undefined as string | undefined, // Added property
    readAsDataURL: vi.fn(function(this: any) {
      setTimeout(() => {
        this.result = dataUri // Added property assignment
        if (this.onload) this.onload({ target: { result: dataUri } })
      }, 0)
    }),
    onload:  null as ((e: { target: { result: string } }) => void) | null,
    onerror: null as (() => void) | null,
  }
  vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockReader as unknown as FileReader)
  return mockReader
}

function mockFileReaderError() {
  const mockReader = {
    readAsDataURL: vi.fn(function(this: { onerror: (() => void) | null }) {
      setTimeout(() => { if (this.onerror) this.onerror() }, 0)
    }),
    onload:  null as ((e: { target: { result: string } }) => void) | null,
    onerror: null as (() => void) | null,
  }
  vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockReader as unknown as FileReader)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fileToBase64', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('converts a valid JPEG file to base64', async () => {
    mockFileReaderSuccess('data:image/jpeg;base64,abc123')
    const file   = makeFile('photo.jpg', 'image/jpeg', 100)
    const result = await fileToBase64(file)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dataUri).toBe('data:image/jpeg;base64,abc123')
      expect(result.sizeKb).toBeGreaterThanOrEqual(0)
    }
  })

  it('converts a valid PNG file', async () => {
    mockFileReaderSuccess('data:image/png;base64,xyz')
    const file   = makeFile('image.png', 'image/png', 200)
    const result = await fileToBase64(file)
    expect(result.success).toBe(true)
  })

  it('rejects unsupported file type', async () => {
    const file   = makeFile('doc.pdf', 'application/pdf', 100)
    const result = await fileToBase64(file)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/Unsupported file type/i)
  })

  it('rejects files over 5 MB', async () => {
    const file   = makeFile('huge.jpg', 'image/jpeg', 6 * 1024 * 1024)
    const result = await fileToBase64(file)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/too large/i)
  })

  it('returns error when FileReader fails', async () => {
    mockFileReaderError()
    const file   = makeFile('broken.jpg', 'image/jpeg', 100)
    const result = await fileToBase64(file)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/Failed to read/i)
  })

  it('accepts WebP files', async () => {
    mockFileReaderSuccess('data:image/webp;base64,abc')
    const file   = makeFile('img.webp', 'image/webp', 100)
    const result = await fileToBase64(file)
    expect(result.success).toBe(true)
  })
})