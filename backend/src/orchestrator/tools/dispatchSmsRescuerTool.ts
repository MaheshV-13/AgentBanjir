/**
 * @module genkit/tools/dispatchSmsRescuerTool
 *
 * Genkit `defineTool` — simulates dispatching an SMS alert to the nearest
 * rescue coordinator.
 *
 * ── Trigger ───────────────────────────────────────────────────────────────────
 * Called ONLY when severity_level === "High".
 * The flow's severity router is the sole gatekeeper — this tool has no guard.
 *
 * ── Simulation (hackathon scope) ─────────────────────────────────────────────
 * Generates a mock UUID as message_id and returns a SmsDispatchOutput receipt.
 * The SMS body is constructed but never sent to a real gateway.
 *
 * ── Production path ───────────────────────────────────────────────────────────
 * Replace the simulation block with:
 *   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
 *   const msg = await client.messages.create({ to, from, body });
 * Credentials must come from GCP Secret Manager — never hardcoded.
 *
 * ── Error contract ────────────────────────────────────────────────────────────
 * This tool throws on failure — it does NOT swallow errors.
 * floodCrisisOrchestrationFlow catches tool errors and degrades gracefully.
 */
import { v4 as uuidv4 } from "uuid";
import { ai } from "@/orchestrator/genkit.config";
import { config } from "@/config/env";
import { logger } from "@/logger/logger";
import {
  SmsDispatchInputSchema,
  SmsDispatchOutputSchema,
  type SmsDispatchOutput,
} from "@/orchestrator/schemas/agentSchemas";

export const dispatchSmsRescuerTool = ai.defineTool(
  {
    name: "dispatchSmsRescuerTool",
    description:
      "Simulates dispatching an SMS alert to the nearest rescue coordinator. " +
      "Triggered for High severity flood incidents only. " +
      "Returns a dispatch receipt confirming the message was sent.",
    inputSchema:  SmsDispatchInputSchema,
    outputSchema: SmsDispatchOutputSchema,
  },
  async (input): Promise<SmsDispatchOutput> => {
    const { incident_id, severity_level, gps_coordinates, specific_needs } = input;

    logger.info("[dispatchSmsRescuerTool] Initiating SMS dispatch", {
      incident_id,
      severity_level,
      needs_count: specific_needs.length,
    });

    // ── Simulation block ──────────────────────────────────────────────────────
    // Production: replace with Twilio REST API call.
    const recipient = config.smsMockRecipient;

    // Body constructed for production parity — not sent in simulation.
    // DO NOT log smsBody: it contains GPS coordinates (operationally sensitive).
    const smsBody =
      `[AGENTBANJIR] HIGH SEVERITY FLOOD ALERT\n` +
      `Incident: ${incident_id}\n` +
      `Location: ${gps_coordinates.lat.toFixed(6)}, ${gps_coordinates.lng.toFixed(6)}\n` +
      `Needs: ${specific_needs.join(", ")}\n` +
      `ACTION REQUIRED: Dispatch rescue team immediately.`;

    // Simulate network I/O latency
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Suppress unused-variable warning for smsBody in simulation mode.
    // In production: pass smsBody to twilio.messages.create({ body: smsBody }).
    void smsBody;

    const messageId   = uuidv4();
    const dispatchedAt = new Date().toISOString();

    logger.info("[dispatchSmsRescuerTool] SMS dispatched (simulated)", {
      incident_id,
      message_id:          messageId,
      simulated_recipient: recipient,
      dispatched_at:       dispatchedAt,
    });

    return {
      success:             true,
      message_id:          messageId,
      simulated_recipient: recipient,
      dispatched_at:       dispatchedAt,
    };
    // ── End simulation block ──────────────────────────────────────────────────
  }
);
