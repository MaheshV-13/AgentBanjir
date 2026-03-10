/**
 * @module server
 *
 * Application entry point.
 *
 * Binds the Express app to process.env.PORT (Cloud Run injects 8080).
 * Implements graceful shutdown for SIGTERM and SIGINT to allow in-flight
 * requests to complete before the container is terminated — critical for
 * Cloud Run's rolling deployment strategy.
 *
 * This module is intentionally minimal: all application configuration lives
 * in app.ts. This separation ensures server.ts is not imported in tests,
 * preventing port-binding side effects during the Jest test run.
 */
import { createApp } from "./app";
import { config }    from "@/config/env";
import { logger }    from "@/logger/logger";

// ─── Boot ─────────────────────────────────────────────────────────────────────

const app    = createApp();
const server = app.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`, {
    env:     config.nodeEnv,
    project: config.googleCloudProject,
  });
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

/**
 * Gracefully shuts down the HTTP server, allowing in-flight requests up to
 * a 10-second deadline before forcing process exit. Cloud Run sends SIGTERM
 * before terminating a container instance; this handler ensures clean teardown.
 *
 * @param signal - The OS signal that triggered shutdown (SIGTERM | SIGINT).
 */
function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received — initiating graceful shutdown`);

  // Stop accepting new connections immediately.
  server.close((err) => {
    if (err) {
      logger.error("Error during server close", { error: (err as Error).message });
      process.exit(1);
    }

    logger.info("All connections closed — process exiting cleanly");
    process.exit(0);
  });

  // Force exit if graceful close takes longer than 10 seconds.
  // Cloud Run's default SIGTERM-to-SIGKILL window is ~10s.
  setTimeout(() => {
    logger.error("Graceful shutdown timeout exceeded — forcing exit");
    process.exit(1);
  }, 10_000).unref(); // .unref() prevents this timer from keeping the event loop alive.
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

// ─── Unhandled Rejection Safety Net ──────────────────────────────────────────
// Winston's rejectionHandlers transport already logs these; this handler
// ensures the process exits with a non-zero code to trigger Cloud Run restarts.
process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled promise rejection — initiating shutdown", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  gracefulShutdown("unhandledRejection");
});
