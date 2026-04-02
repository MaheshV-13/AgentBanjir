import { Router, type Request, type Response } from "express";
import twilio from "twilio";
import { v4 as uuidv4 } from "uuid";
import { extractFromGemini } from "@/ai/geminiExtractionService";
import { logger }            from "@/logger/logger";
import { signalStore }       from "@/store/signalStore";
import type { MasterInputSchemaType } from "@/schemas/masterInputSchema";
import type { EnrichedSignal, SeverityLevel } from "@/types/signal.types";

export const twilioWebhookRouter = Router();

// Initialize the Twilio REST Client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

twilioWebhookRouter.post("/", (req: Request, res: Response) => {
  const { Body, From, To, Latitude, Longitude } = req.body;

  // 1. INSTANTLY ACKNOWLEDGE TWILIO (Prevents 15-second timeout)
  res.status(200).type("text/xml").send("<Response></Response>");

  logger.info(`[Webhook] Incoming signal from ${From}. Processing asynchronously...`);

  // 2. RUN AI AND DB IN THE BACKGROUND
  (async () => {
    try {
      if (!Latitude || !Longitude) {
        await twilioClient.messages.create({
          body: "AgentBanjir: We received your message, but we need your coordinates. Please share your 'Location' pin via WhatsApp.",
          from: To, // The Sandbox Number
          to: From, // The Victim's Number
        });
        return;
      }

      // Prepare input for AI
      const masterInput: MasterInputSchemaType = {
        gps_coordinates: { lat: parseFloat(Latitude), lng: parseFloat(Longitude) },
        raw_message: Body || "Location pin shared",
        image_base64: "", 
        simulated_user_verified: true,
      };

      // Extract data using Genkit
      const extraction = await extractFromGemini(masterInput);

      // Construct the EnrichedSignal
      const signalId = `wa-${uuidv4()}`;
      const now = new Date().toISOString();
      const severity = (extraction.severity_level as SeverityLevel) || "High";

      const enrichedSignal: EnrichedSignal = {
        id: signalId,
        gps_coordinates: { lat: parseFloat(Latitude), lng: parseFloat(Longitude) },
        severity_level: severity,
        ai_confidence_score: extraction.ai_confidence_score ?? 0,
        specific_needs: extraction.specific_needs ?? [],
        status: "Pending_Human_Review",
        created_at: now,
        updated_at: now,
      };

      // Save to DB
      await signalStore.upsert(enrichedSignal);
      logger.info("[Webhook] Signal persisted to database", { signalId });

      // 3. SEND THE AI REPLY VIA REST API
      await twilioClient.messages.create({
        body: `AgentBanjir: Distress signal logged. Severity marked as ${severity}. Your coordinates have been forwarded to the Command Center. Stay safe.`,
        from: To,
        to: From,
      });

    } catch (error: any) {
      logger.error("[Webhook] Async Processing Error:", error);
      
      // If the error is a Twilio Limit (Code 63038), do NOT try to send another message
      if (error.code === 63038) {
        logger.warn("[Webhook] Twilio daily limit reached. Bypassing outbound SMS. Signal was still processed internally.");
        return;
      }

      // Only attempt fallback SMS if we know we haven't hit the account limit
      try {
         await twilioClient.messages.create({
          body: "AgentBanjir: Signal received. An operator is reviewing your case manually.",
          from: To,
          to: From,
        });
      } catch (fallbackError) {
         logger.error("[Webhook] Failed to send fallback message:", fallbackError);
      }
    }
  })(); // Immediately invoke the async function
});