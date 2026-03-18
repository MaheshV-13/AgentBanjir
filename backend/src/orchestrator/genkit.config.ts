/**
 * @module genkit/genkit.config
 *
 * Single Genkit initialisation root for the AgentBanjir orchestrator.
 * No other file in this project should call genkit(...).
 *
 * The exported `ai` instance is the shared handle for:
 *   ai.defineFlow(...)  → flow definitions
 *   ai.defineTool(...)  → tool definitions
 *
 * Uses the project's shared config and logger — no new dependencies introduced.
 */
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { config } from "@/config/env";
import { logger } from "@/logger/logger";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: config.geminiApiKey,
    }),
  ],
  // Default model for any ad-hoc generation steps.
  // floodCrisisOrchestrationFlow uses deterministic routing — Gemini is NOT
  // called during normal flow execution. This is declared for completeness.
  model: "googleai/gemini-2.0-flash",
});

logger.info("[genkit.config] Genkit initialised with Google AI plugin.");
