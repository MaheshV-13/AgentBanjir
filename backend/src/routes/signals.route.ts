/**
 * @module routes/signals.route
 *
 * GET /api/v1/signals
 *
 * Returns all enriched signals from the in-memory store, sorted by severity
 * (High → Medium → Low) and optionally filtered by a ?severity= query param.
 * Polled periodically by Member 3's dashboard to refresh the incident table.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { signalStore }               from "@/store/signalStore";
import type {
  SeverityLevel,
  SignalsListResponse,
} from "@/types/signal.types";

export const signalsRouter = Router();

/** Canonical severity ordering for sort. Higher index = lower priority. */
const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  High:   0,
  Medium: 1,
  Low:    2,
};

/** Valid severity values accepted by the ?severity= query param. */
const VALID_SEVERITY_VALUES: SeverityLevel[] = ["High", "Medium", "Low"];

/**
 * @route   GET /api/v1/signals
 * @desc    Retrieve all enriched signals sorted High → Medium → Low.
 * @query   severity {string} Optional filter: "High" | "Medium" | "Low"
 * @access  Public (no auth — hackathon scope; login-free per clarification #7)
 */
signalsRouter.get("/", async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const severityFilter = req.query["severity"] as string | undefined;

    // Validate optional ?severity= query param if provided.
    if (
      severityFilter !== undefined &&
      !VALID_SEVERITY_VALUES.includes(severityFilter as SeverityLevel)
    ) {
      res.status(400).json({
        error: {
          code:       "INVALID_QUERY_PARAM",
          message:    `Invalid severity filter. Allowed values: ${VALID_SEVERITY_VALUES.join(", ")}`,
          request_id: res.locals["requestId"] ?? "unknown",
          timestamp:  new Date().toISOString(),
        },
      });
      return;
    }

    let signals = await signalStore.getAll();

    // Apply optional severity filter before sorting.
    if (severityFilter) {
      signals = signals.filter(
        (s) => s.severity_level === (severityFilter as SeverityLevel)
      );
    }

    // Sort High → Medium → Low per SDD §6.2.
    signals.sort(
      (a, b) => SEVERITY_ORDER[a.severity_level] - SEVERITY_ORDER[b.severity_level]
    );

    const body: SignalsListResponse = {
      signals,
      total:     signals.length,
      synced_at: new Date().toISOString(),
    };

    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
});
