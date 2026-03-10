/**
 * @module routes/health.route
 *
 * GET /health
 *
 * Cloud Run startup and liveness probe target. Returns a 200 with process
 * uptime and a timestamp. No authentication — Cloud Run probes are internal.
 *
 * Per SDD §6.4, this endpoint is registered at /health (not /api/v1/health)
 * so Cloud Run's default health check path does not require custom configuration.
 */
import { Router, type Request, type Response } from "express";
import type { HealthCheckResponse }             from "@/types/signal.types";

export const healthRouter = Router();

/**
 * @route   GET /health
 * @desc    Liveness and readiness probe for Cloud Run.
 * @access  Public (no auth — Cloud Run internal probe)
 */
healthRouter.get("/", (_req: Request, res: Response) => {
  const body: HealthCheckResponse = {
    status:    "ok",
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(body);
});
