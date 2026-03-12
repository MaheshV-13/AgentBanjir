/**
 * @module config/env
 *
 * Typed environment variable loader.
 *
 * Loads .env via dotenv, validates all required variables at process startup,
 * and exports a frozen, type-safe config object. If any required variable is
 * absent, the process exits immediately with an actionable error message —
 * fail-fast prevents obscure runtime failures inside route handlers.
 */
import "dotenv/config";

// ─── Required Variable Keys ───────────────────────────────────────────────────
// Extending this array is the single change required to add a new required var.
const REQUIRED_VARS = [
  "GEMINI_API_KEY",
  "GOOGLE_CLOUD_PROJECT",
  
] as const;

// ─── Optional Variable Defaults ───────────────────────────────────────────────
const PORT_DEFAULT            = "8080";
const NODE_ENV_DEFAULT        = "development";
const CORS_ORIGIN_DEFAULT     = "http://localhost:5173";
const LOG_LEVEL_DEFAULT       = "info";
const SMS_MOCK_RECIPIENT = "+60123456789";

/**
 * Validates that all required environment variables are present.
 * Exits the process with code 1 if any are missing.
 */
function assertRequiredVars(): void {
  const missing = REQUIRED_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ""
  );

  if (missing.length > 0) {
    // Deliberately use console.error here — logger may not be initialised yet.
    console.error(
      `[FATAL] Missing required environment variables: ${missing.join(", ")}\n` +
      `Copy .env.example to .env and populate the values before starting.`
    );
    process.exit(1);
  }
}

assertRequiredVars();

// ─── Typed Config Object ──────────────────────────────────────────────────────

export type NodeEnv = "development" | "production" | "test";

export interface AppConfig {
  /** TCP port the Express server binds to. Cloud Run injects 8080. */
  readonly port: number;
  /** Execution environment. Drives log format and error verbosity. */
  readonly nodeEnv: NodeEnv;
  /** Gemini API key — injected from GCP Secret Manager at runtime. */
  readonly geminiApiKey: string;
  /** GCP project ID — used by Vertex AI and Secret Manager clients. */
  readonly googleCloudProject: string;
  /**
   * Allowed CORS origin for Member 3's Vite dashboard.
   * Set to the Cloud Run URL or static host URL in production.
   */
  readonly corsOrigin: string;
  /** Winston log level. Set to "debug" to enable full request/response detail. */
  readonly logLevel: string;
  /** When true, writes structured logs to a file transport in addition to console. */
  readonly logToFile: boolean;
  /** Convenience flag — true in production environment. */
  readonly isProduction: boolean;
}

const rawNodeEnv = process.env["NODE_ENV"] ?? NODE_ENV_DEFAULT;
const nodeEnv: NodeEnv = (["development", "production", "test"].includes(rawNodeEnv)
  ? rawNodeEnv
  : "development") as NodeEnv;

export const config: Readonly<AppConfig> = Object.freeze({
  port:               parseInt(process.env["PORT"] ?? PORT_DEFAULT, 10),
  nodeEnv,
  geminiApiKey:       process.env["GEMINI_API_KEY"]!,
  googleCloudProject: process.env["GOOGLE_CLOUD_PROJECT"]!,
  corsOrigin:         process.env["VITE_FRONTEND_ORIGIN"] ?? CORS_ORIGIN_DEFAULT,
  logLevel:           process.env["LOG_LEVEL"] ?? LOG_LEVEL_DEFAULT,
  logToFile:          process.env["LOG_TO_FILE"] === "true",
  isProduction:       nodeEnv === "production",
});
