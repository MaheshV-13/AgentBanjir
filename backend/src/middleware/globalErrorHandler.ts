/**
 * @module middleware/globalErrorHandler
 *
 * Express global error handler (4-argument signature required by Express).
 *
 * Intercepts all errors thrown or passed via next(err) anywhere in the pipeline
 * and normalises them into the standard ApiErrorResponse envelope. Stack traces
 * are logged server-side via Winston but NEVER sent to the client in production.
 *
 * Error classification matrix is implemented per SDD §10.2.
 */
import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { logger }   from "@/logger/logger";
import { config }   from "@/config/env";
import type { ApiErrorResponse } from "@/types/signal.types";

// ─── Custom Application Error ─────────────────────────────────────────────────

/**
 * Typed application error class.
 * Route handlers and service modules should throw AppError instances
 * to provide a machine-readable code alongside the HTTP status.
 */
export class AppError extends Error {
  constructor(
    /** Machine-readable error code for the client (e.g. "NOT_FOUND"). */
    public readonly code: string,
    /** Human-readable message safe to display to end users. */
    message: string,
    /** HTTP status code to send in the response. */
    public readonly statusCode: number = 500,
    /** Optional extra data (e.g. allowed values list). */
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    // Restores correct prototype chain when extending Error in TypeScript.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Error Handler Middleware ─────────────────────────────────────────────────

/**
 * Global Express error handler.
 * Must be registered as the LAST middleware in app.ts (after all routes).
 * Express identifies it as an error handler by its 4-parameter signature.
 *
 * @param err  - The thrown error (any type — may come from third-party libs).
 * @param req  - Express request object.
 * @param res  - Express response object.
 * @param next - Express next function (required for error handler signature).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err:  unknown,
  req:  Request,
  res:  Response,
  next: NextFunction  // Required for Express error handler recognition.
): void {
  const requestId  = (res.locals["requestId"] as string | undefined) ?? "unknown";
  const timestamp  = new Date().toISOString();

  // ── Zod Validation Error ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    logger.warn("Request validation failed", { req_id: requestId, errors: err.errors });

    const body: ApiErrorResponse = {
      error: {
        code:       "VALIDATION_ERROR",
        message:    "Request body failed schema validation.",
        request_id: requestId,
        timestamp,
        details:    err.errors,
      },
    };
    res.status(400).json(body);
    return;
  }

  // ── Known Application Error ───────────────────────────────────────────────
  if (err instanceof AppError) {
    // Log upstream failures (502s) at error level; client errors at warn level.
    const logFn = err.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
    logFn(`AppError: ${err.message}`, { req_id: requestId, code: err.code });

    const body: ApiErrorResponse = {
      error: {
        code:       err.code,
        message:    err.message,
        request_id: requestId,
        timestamp,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unhandled / Unknown Error ─────────────────────────────────────────────
  // Log the full stack server-side; send a sanitised message to the client.
  const errorMessage = err instanceof Error ? err.message : String(err);
  const stack        = err instanceof Error ? err.stack   : undefined;

  logger.error("Unhandled exception", {
    req_id: requestId,
    code:   "INTERNAL_ERROR",
    error:  errorMessage,
    // Only include stack trace in non-production logs.
    ...(config.isProduction ? {} : { stack }),
  });

  const body: ApiErrorResponse = {
    error: {
      code:       "INTERNAL_ERROR",
      message:    "An unexpected error occurred. Please try again later.",
      request_id: requestId,
      timestamp,
    },
  };
  res.status(500).json(body);
}
