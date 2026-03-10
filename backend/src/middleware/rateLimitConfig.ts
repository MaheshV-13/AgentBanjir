/**
 * @module middleware/rateLimitConfig
 *
 * Express rate limit configurations.
 *
 * Two limits are exported:
 *  - globalRateLimit:   Applied app-wide via app.ts (100 req / 15 min per IP).
 *  - analyzeSignalLimit: Applied to POST /api/v1/analyze-signal only
 *                        (10 req / 15 min per IP — Gemini calls are expensive).
 *
 * Rate limiting is strictly per-IP as confirmed in clarification item #5.
 * The simulated_user_verified field is not used for limiting.
 */
import rateLimit, { type Options } from "express-rate-limit";

/** 15-minute window in milliseconds — shared across all limit configs. */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Builds the standard error envelope for rate limit responses,
 * matching the ApiErrorResponse shape defined in signal.types.ts.
 */
const rateLimitHandler: Options["handler"] = (_req, res) => {
  res.status(429).json({
    error: {
      code:       "RATE_LIMIT_EXCEEDED",
      message:    "Too many requests. Please wait before retrying.",
      request_id: res.locals["requestId"] ?? "unknown",
      timestamp:  new Date().toISOString(),
    },
  });
};

/**
 * Global rate limiter — applied to all routes.
 * 100 requests per 15-minute window per IP.
 */
export const globalRateLimit = rateLimit({
  windowMs:          WINDOW_MS,
  max:               100,
  standardHeaders:   true,   // Emits RateLimit-* headers (RFC 6585).
  legacyHeaders:     false,  // Suppresses deprecated X-RateLimit-* headers.
  keyGenerator:      (req) => req.ip ?? "unknown",
  handler:           rateLimitHandler,
  // Skip rate limiting in test environments to avoid flaky Jest runs.
  skip:              () => process.env["NODE_ENV"] === "test",
});

/**
 * Strict rate limiter for the AI analysis endpoint.
 * 10 requests per 15-minute window per IP.
 *
 * Applied directly in analyzeSignal.route.ts — not via app.ts —
 * so it supplements (rather than replaces) the global limit.
 */
export const analyzeSignalLimit = rateLimit({
  windowMs:          WINDOW_MS,
  max:               10,
  standardHeaders:   true,
  legacyHeaders:     false,
  keyGenerator:      (req) => req.ip ?? "unknown",
  handler:           rateLimitHandler,
  skip:              () => process.env["NODE_ENV"] === "test",
});
