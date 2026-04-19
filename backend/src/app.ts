/**
 * @module app
 *
 * Express application factory.
 *
 * Constructs and returns the Express app with the full middleware pipeline
 * and route registry, without binding to a port. Separating app creation from
 * port binding keeps this module fully testable via Supertest without opening
 * a real socket.
 *
 * Middleware order is intentional and matches SDD §7 exactly:
 *   helmet → cors → body-parser → rate-limit → requestLogger → routes → errorHandler
 */
import express, { type Application, type Request, type Response } from "express";
import helmet                from "helmet";
import cors                  from "cors";


import { corsOptions }       from "@/middleware/corsConfig";
import { globalRateLimit }   from "@/middleware/rateLimitConfig";
import { requestLogger }     from "@/middleware/requestLogger";
import { globalErrorHandler } from "@/middleware/globalErrorHandler";

import { healthRouter }         from "@/routes/health.route";
import { signalsRouter }        from "@/routes/signals.route";
import { analyzeSignalRouter }  from "@/routes/analyzeSignal.route";
import { signalStatusRouter }   from "@/routes/signalStatus.route";
import { twilioWebhookRouter }  from "@/routes/twilioWebhook.route";

import { logger } from "@/logger/logger";

/**
 * Creates and configures the Express application instance.
 *
 * @returns Configured Express Application (not yet listening).
 */
export function createApp(): Application {
  const app = express();

  // ── 1. Security Headers ─────────────────────────────────────────────────────
  // Helmet sets 11 HTTP security headers by default (CSP, HSTS, X-Frame-Options,
  // X-Content-Type-Options, etc.). Must be the FIRST middleware registered.
  app.use(helmet());

  // ── 2. CORS ─────────────────────────────────────────────────────────────────
  // Origin whitelist is read from VITE_FRONTEND_ORIGIN env var at runtime.
  // Preflight OPTIONS requests are handled automatically by the cors package.
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions)); // Explicit preflight for all routes.

  // ── 3. Body Parser ──────────────────────────────────────────────────────────
  // 6 MB limit accommodates base64-encoded flood images per SDD §9.2.
  app.use(express.json({ limit: "6mb" }));
  app.use(express.urlencoded({ extended: true, limit: "6mb" }));

  // ── 4. Global Rate Limiter ──────────────────────────────────────────────────
  // Per-IP windowing: 100 requests / 15 min across all endpoints.
  // Per SDD §5, the /analyze-signal route applies a stricter 10 req / 15 min
  // limit registered directly on that router.
  app.use(globalRateLimit);

  // ── 5. Request Logger ───────────────────────────────────────────────────────
  // Assigns a UUID to each request and attaches it to res.locals for
  // downstream use in route handlers and the error handler.
  app.use(requestLogger);

  // ── 6. Health Check (exempt from /api/v1 prefix) ───────────────────────────
  // Cloud Run startup and liveness probes target GET /health directly.
  app.use("/health", healthRouter);

  // ── 7. API Routes ───────────────────────────────────────────────────────────
  app.use("/api/v1/analyze-signal", analyzeSignalRouter);
  app.use("/api/v1/signals",        signalsRouter);
  app.use("/api/v1/signals",        signalStatusRouter);
  app.use("/api/v1/webhook/twilio", twilioWebhookRouter);

  // ── 8. 404 Catch-All ────────────────────────────────────────────────────────
  // Must come AFTER all route registrations. Returns a normalised error envelope
  // instead of Express's default HTML 404 page.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code:       "NOT_FOUND",
        message:    "The requested endpoint does not exist.",
        request_id: res.locals["requestId"] ?? "unknown",
        timestamp:  new Date().toISOString(),
      },
    });
  });

  // ── 9. Global Error Handler ─────────────────────────────────────────────────
  // Must be registered LAST — Express identifies error handlers by arity (4 args).
  // Normalises all thrown errors into the standard ApiErrorResponse envelope.
  app.use(globalErrorHandler);

  logger.info("Express application configured", {
    middlewarePipeline: [
      "helmet", "cors", "bodyParser", "rateLimit", "requestLogger",
      "routes", "globalErrorHandler",
    ],
  });

  return app;
}
