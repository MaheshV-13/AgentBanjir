/**
 * @module middleware/requestLogger
 *
 * Winston request lifecycle middleware.
 *
 * On request arrival:
 *  - Generates a v4 UUID and attaches it to res.locals.requestId.
 *  - Sets X-Request-ID response header for client-side correlation.
 *  - Logs the start of the request at DEBUG level (suppressed in production).
 *
 * On response finish:
 *  - Calculates total latency in milliseconds.
 *  - Logs the completion milestone at INFO level (always emitted).
 *
 * PII POLICY: raw_message and image_base64 are NEVER logged.
 * The middleware only captures method, path, status code, and latency.
 */
import { type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 }         from "uuid";
import { logger, logRequestMilestone } from "@/logger/logger";

/**
 * Express middleware that assigns a request ID and logs the request lifecycle.
 * Attaches `requestId` to `res.locals` for downstream access in handlers and
 * the global error handler.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Attach to res.locals for access in route handlers and error handler.
  res.locals["requestId"] = requestId;

  // Expose to client for distributed tracing (Member 3 dashboard can log this).
  res.setHeader("X-Request-ID", requestId);

  // DEBUG-only: full request start event. Suppressed unless LOG_LEVEL=debug.
  logger.debug("Request received", {
    req_id: requestId,
    method: req.method,
    path:   req.path,
    ip:     req.ip,
  });

  // Attach a one-time listener to the response 'finish' event to log
  // the completion milestone after headers are flushed.
  res.once("finish", () => {
    logRequestMilestone(
      requestId,
      req.method,
      req.path,
      res.statusCode,
      Date.now() - startTime
    );
  });

  next();
}
