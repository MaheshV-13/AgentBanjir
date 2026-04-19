/**
 * @module ai/geminiExtractionService
 *
 * Calls Gemini 2.0 Flash via the shared Genkit `ai` instance to extract
 * structured crisis data from a raw multimodal distress signal.
 *
 * This module is intentionally narrow in responsibility:
 *   Input  → MasterInputSchemaType (validated upstream by the gateway)
 *   Output → GeminiExtraction (4-field intermediate type, internal to src/ai/)
 *
 * The output of this service is consumed ONLY by SignalOrchestrator —
 * never returned directly to the gateway. The `location` field in particular
 * is used to query Vertex AI Search and then discarded from the final output.
 *
 * Key design decisions:
 *   - Uses the shared `ai` instance from genkit.config — no second SDK init.
 *   - Conditionally includes the image part; image_base64 may be an empty
 *     string for text-only signals (per MasterInputSchema validation contract).
 *   - Gemini output is schema-enforced via Genkit's `output.schema` (JSON mode).
 *   - Null fields from Gemini are handled with logged defaults in SignalOrchestrator.
 */

import { z } from "zod";
import { logger } from "@/logger/logger";
import { ai } from "@/orchestrator/genkit.config";
import { retrieveBoatsTool } from "@/ai/tools/retrieveBoatsTool";

import { SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION } from "@/ai/prompts/systemPrompt";
import type { MasterInputSchemaType } from "@/schemas/masterInputSchema";

// ─── Internal Extraction Schema ───────────────────────────────────────────────
// Scoped to this module — not exported. The gateway only ever sees the merged
// PartialEnrichedSignalSchemaType produced by SignalOrchestrator.

const GeminiExtractionSchema = z.object({
  /** Most specific place name in the message; null if unextractable. */
  location: z.string().nullable(),

  /** Severity per SDD §9.1 rubric; null only if zero signal exists. */
  severity_level: z.enum(["Low", "Medium", "High"]).nullable(),

  /**
   * Free-form need strings (clarification item #2 answer: no controlled vocab).
   * Null only if message is too corrupted to parse; empty array if no needs stated.
   */
  specific_needs: z.array(z.string()).nullable(),

  /** Self-reported confidence integer 0–100; minimum floor 10 per prompt contract. */
  ai_confidence_score: z.number().int().min(0).max(100).nullable(),

  /** 
   * The array of boats returned by the Vertex AI tool. 
   */
  nearest_boats: z.array(z.any()).nullable().optional()
    .describe("You MUST call the retrieveNearestRescueBoats tool to populate this array if the user needs a boat or evacuation."),
});

export type GeminiExtraction = z.infer<typeof GeminiExtractionSchema>;

// ─── Prompt Construction ──────────────────────────────────────────────────────

type GenkitPromptPart =
  | { text: string }
  | { media: { url: string; contentType: string } };

/**
 * Builds the ordered prompt parts array for a Genkit multimodal generate call.
 *
 * Image is prepended before text when present — this ordering follows Gemini's
 * recommended multimodal layout for grounded extraction tasks.
 *
 * @param input - Validated distress signal from the gateway middleware.
 * @returns Ordered array of Genkit prompt parts (image? + text).
 */
function buildPromptParts(input: MasterInputSchemaType): GenkitPromptPart[] {
  const { gps_coordinates, image_base64, raw_message } = input;
  const parts: GenkitPromptPart[] = [];

  // image_base64 is validated as '' | base64string by MasterInputSchema.
  // An empty string means the citizen submitted a text-only distress signal.
  if (image_base64.length > 0) {
    // Strip data URI prefix if the client sends a full data URL
    // (e.g. "data:image/jpeg;base64,/9j/...") — Genkit expects raw base64.
    const rawBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
    parts.push({
      media: {
        url: `data:image/jpeg;base64,${rawBase64}`,
        contentType: "image/jpeg",
      },
    });
  }

  parts.push({
    text: [
      `GPS Location: lat=${gps_coordinates.lat}, lng=${gps_coordinates.lng}`,
      `Distress Message: "${raw_message}"`,
      "",
      "--- CRITICAL AGENT INSTRUCTION ---",
      "If the distress message requests a boat, mentions evacuation, or implies rising water:",
      "1. You MUST call the 'retrieveNearestRescueBoats' tool BEFORE generating your final JSON response.",
      "2. You must place the exact data returned by that tool into the 'nearest_boats' field of your JSON output.",
      "----------------------------------",
      "",
      "Extract the crisis data from the message and image above.",
      "Return ONLY the JSON object — no markdown, no prose.",
    ].join("\n"),
  });

  return parts;
}

// ─── Core Service Function ────────────────────────────────────────────────────

/**
 * Calls Gemini 2.0 Flash via Genkit to extract structured crisis fields.
 *
 * Uses `output.schema` (JSON mode) to enforce the extraction schema at the
 * model layer, eliminating markdown wrapping and unexpected field injection.
 *
 * @param input - Validated `MasterInputSchemaType` from the gateway.
 * @returns Extracted `GeminiExtraction` object with nullable fields.
 *
 * @throws {Error} If the Genkit generate call fails (network / quota / auth).
 * @throws {Error} If Gemini returns null output despite schema enforcement.
 */
export async function extractFromGemini(
  input: MasterInputSchemaType
): Promise<GeminiExtraction> {
  const promptParts = buildPromptParts(input);
  const hasImage = input.image_base64.length > 0;

  logger.debug("[GeminiExtractionService] Calling Gemini", {
    prompt_version: SYSTEM_PROMPT_VERSION,
    has_image: hasImage,
    message_length: input.raw_message.length,
  });

  const response = await ai.generate({
    model: "googleai/gemini-2.5-flash",
    system: SYSTEM_PROMPT,
    prompt: promptParts,
    tools: [retrieveBoatsTool],
    output: {
      format: "json",
      schema: GeminiExtractionSchema,
    },
    config: {
      temperature: 0.1, // Low temperature → deterministic extraction
    },
  });

  // Genkit returns null output when the model cannot satisfy the schema —
  // treat as a hard failure to prevent silent null propagation downstream.
  if (response.output === null || response.output === undefined) {
    throw new Error(
      "Gemini returned null output — schema enforcement failed. " +
      "Check the system prompt output contract and model version."
    );
  }

  logger.debug("[GeminiExtractionService] Extraction complete", {
    location: response.output.location,
    severity_level: response.output.severity_level,
    ai_confidence_score: response.output.ai_confidence_score,
    needs_count: response.output.specific_needs?.length ?? 0,
  });

  return response.output;
}
