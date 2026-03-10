/**
 * @module schemas/masterInputSchema
 *
 * Zod schema for the Master Input Signal.
 *
 * This is the primary validation gate — executed before any upstream AI call.
 * Unknown keys are stripped (Zod's .strict() equivalent via .strip()) to prevent
 * payload injection. Any change to this schema is a breaking change requiring
 * coordination with Member 3 (dashboard) per the Integration Registry (SDD §16).
 */
import { z } from "zod";

export const GpsCoordinatesSchema = z.object({
  lat: z
    .number({ required_error: "lat is required", invalid_type_error: "lat must be a number" })
    .min(-90,  { message: "lat must be between -90 and 90" })
    .max( 90,  { message: "lat must be between -90 and 90" }),
  lng: z
    .number({ required_error: "lng is required", invalid_type_error: "lng must be a number" })
    .min(-180, { message: "lng must be between -180 and 180" })
    .max( 180, { message: "lng must be between -180 and 180" }),
});

export const MasterInputSchema = z
  .object({
    gps_coordinates: GpsCoordinatesSchema,

    /**
     * Base64-encoded JPEG or PNG image of the flood scene.
     * 6 MB body limit is enforced at the body-parser layer.
     * Min-length check prevents empty strings from reaching Gemini.
     */
    image_base64: z
      .string({ required_error: "image_base64 is required" })
      .min(100, { message: "image_base64 appears to be empty or invalid" }),

    /**
     * Free-text distress message from the citizen. Accepts BM or EN.
     * Min 3 chars to reject meaningless single-character submissions.
     */
    raw_message: z
      .string({ required_error: "raw_message is required" })
      .min(3,    { message: "raw_message is too short (min 3 characters)" })
      .max(2000, { message: "raw_message exceeds maximum length of 2000 characters" }),

    /** Indicates whether the submitting user passed identity verification. */
    simulated_user_verified: z.boolean({
      required_error:     "simulated_user_verified is required",
      invalid_type_error: "simulated_user_verified must be a boolean",
    }),
  })
  // Strip unknown keys to prevent prototype pollution and schema injection.
  .strict();

/** Inferred TypeScript type from the Zod schema. */
export type MasterInputSchemaType = z.infer<typeof MasterInputSchema>;
