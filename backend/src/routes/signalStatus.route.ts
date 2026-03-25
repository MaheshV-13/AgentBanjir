/**
 * @module routes/signalStatus.route
 *
 * PATCH /api/v1/signals/:id/status
 *
 * Allows the dashboard operator (Member 3) to transition a signal's status
 * from "Pending_Human_Review" to either "Dispatched" or "Rejected".
 * Returns the full updated EnrichedSignal on success.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { z }                 from "zod";
import { signalStore }       from "@/store/signalStore";
import { AppError }          from "@/middleware/globalErrorHandler";
import { logger }            from "@/logger/logger";
import type { SignalStatus } from "@/types/signal.types";

export const signalStatusRouter = Router();

// Operators may only set terminal statuses — "Pending_Human_Review" is assigned
// by the gateway and cannot be re-applied via this endpoint.
const StatusUpdateSchema = z.object({
  status: z.enum(["Dispatched", "Rejected"]),
});

/**
 * @route   PATCH /api/v1/signals/:id/status
 * @desc    Transition signal lifecycle status (operator action).
 * @param   id {string} UUID of the target signal.
 * @body    { status: "Dispatched" | "Rejected" }
 * @access  Public (no auth — hackathon scope)
 */
signalStatusRouter.patch("/:id/status", async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id }      = req.params;
    const requestId   = res.locals["requestId"] as string;

    const parsed      = StatusUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        "INVALID_STATUS",
        `Invalid status value. Allowed values: "Dispatched", "Rejected"`,
        400,
        parsed.error.errors
      );
    }

    const newStatus = parsed.data.status as SignalStatus;

    const updated = await signalStore.updateStatus(id, newStatus); 

    if (!updated) {
      throw new AppError(
        "NOT_FOUND",
        `Signal with id "${id}" was not found in the store.`,
        404
      );
    }

    logger.info(`PATCH /api/v1/signals/${id}/status`, {
      req_id:     requestId,
      new_status: newStatus,
    });

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});
