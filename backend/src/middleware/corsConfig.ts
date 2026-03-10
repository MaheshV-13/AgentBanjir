/**
 * @module middleware/corsConfig
 *
 * CORS options factory.
 *
 * Origin whitelist is read from the VITE_FRONTEND_ORIGIN environment variable
 * at runtime, not at build time. This allows the same Docker image to serve
 * both local development (http://localhost:5173) and production
 * (Cloud Run URL or static host) without a rebuild.
 */
import type { CorsOptions } from "cors";
import { config }           from "@/config/env";
import { logger }           from "@/logger/logger";

// Log the configured origin once at startup — aids debugging CORS preflight failures.
logger.info("CORS origin whitelist configured", { allowedOrigin: config.corsOrigin });

export const corsOptions: CorsOptions = {
  origin: config.corsOrigin,

  // Only the methods consumed by Member 3's dashboard are permitted.
  methods: ["GET", "POST", "PATCH", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Accept", "X-Request-ID"],

  // Allows Member 3's frontend to read response headers like X-Request-ID.
  exposedHeaders: ["X-Request-ID"],

  // No credentials (cookies / auth headers) are used in hackathon scope.
  credentials: false,

  // Cache preflight response for 10 minutes to reduce OPTIONS round-trips.
  maxAge: 600,
};
