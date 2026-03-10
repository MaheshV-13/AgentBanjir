/**
 * @module logger/logger
 *
 * Winston logger factory.
 *
 * Production: Emits structured JSON compatible with Google Cloud Logging.
 * Development: Human-readable colourised output for local iteration.
 *
 * Per the system constraint: Only major milestones are logged at INFO level.
 * Granular debug logs are suppressed unless DEBUG_MODE=true (logLevel=debug).
 * PII fields (raw_message, image_base64) must NEVER be passed to this logger.
 */
import winston from "winston";
import { config } from "@/config/env";

// ─── Custom Log Format ────────────────────────────────────────────────────────

/**
 * Formats a log entry for Google Cloud Logging compatibility.
 * Renames 'level' → 'severity' and preserves all metadata fields.
 */
const gcpJsonFormat = winston.format.combine(
  winston.format.timestamp({ format: "iso" }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    // Destructure known fields; spread remaining metadata into the JSON body.
    const { timestamp, level, message, stack, ...meta } = info;
    return JSON.stringify({
      severity:  level.toUpperCase(),
      timestamp,
      message,
      ...(stack && config.isProduction === false ? { stack } : {}),
      ...meta,
    });
  })
);

const devConsoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(
    ({ timestamp, level, message, ...meta }) =>
      `[${timestamp}] ${level}: ${message}` +
      (Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "")
  )
);

// ─── Transport Configuration ──────────────────────────────────────────────────

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.isProduction ? gcpJsonFormat : devConsoleFormat,
  }),
];

// Opt-in file transport for local debugging or extended log retention.
if (config.logToFile) {
  transports.push(
    new winston.transports.File({
      filename: "logs/app.log",
      format:   gcpJsonFormat,
      maxsize:  10 * 1024 * 1024, // 10 MB per file
      maxFiles: 3,
    })
  );
}

// ─── Logger Instance ──────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  level:             config.logLevel,
  defaultMeta:       { service: "agentbanjir-gateway" },
  transports,
  // Prevents unhandled exceptions from bypassing the logger in production.
  exceptionHandlers: transports,
  rejectionHandlers: transports,
});

/**
 * Convenience helper for logging request milestone events in a consistent
 * structured format. Mirrors the log pattern defined in SDD §11.2.
 *
 * @param requestId - UUID assigned by requestLogger middleware.
 * @param method    - HTTP method (GET, POST, PATCH).
 * @param path      - Request path.
 * @param statusCode - HTTP response status code.
 * @param latencyMs  - Total request latency in milliseconds.
 * @param meta       - Optional additional key-value pairs (incidentId, severity).
 */
export function logRequestMilestone(
  requestId: string,
  method: string,
  path: string,
  statusCode: number,
  latencyMs: number,
  meta?: Record<string, string | number | boolean>
): void {
  logger.info(`${method} ${path}`, {
    req_id:  requestId,
    status:  statusCode,
    latency: `${latencyMs}ms`,
    ...meta,
  });
}
