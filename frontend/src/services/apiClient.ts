import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

// ─────────────────────────────────────────────────────────────────────────────
// AgentBanjir — Axios API Client
//
// Single shared Axios instance consumed by all service functions.
// Responsibilities:
//   • Base URL + timeout from env vars
//   • Request logging in development
//   • Response logging in development
//   • Centralised error normalisation
//
// Zod validation is NOT applied here — it lives in each service function so
// that the error context (which endpoint failed) is preserved.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL  = import.meta.env.VITE_API_BASE_URL  ?? 'http://localhost:8080'
const TIMEOUT_MS = 10_000

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
})

// ── Request interceptor — dev logging ────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (import.meta.env.DEV) {
      console.debug(
        `[API →] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        config.data ?? '',
      )
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor — dev logging + error normalisation ─────────────────

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      console.debug(
        `[API ←] ${response.status} ${response.config.url}`,
        response.data,
      )
    }
    return response
  },
  (error) => {
    // Normalise into a consistent shape so service functions don't need to
    // inspect AxiosError internals directly.
    if (axios.isAxiosError(error)) {
      const status  = error.response?.status
      const message = error.response?.data?.message ?? error.message

      if (import.meta.env.DEV) {
        console.error(`[API ✕] ${status ?? 'network'} — ${message}`, error)
      }

      // Attach a clean message for UI toast rendering in service layer
      error.message = status
        ? `Server error ${status}: ${message}`
        : `Network error — could not reach ${BASE_URL}`
    }
    return Promise.reject(error)
  },
)

export default apiClient