import { z } from "zod";
import { ai } from "@/orchestrator/genkit.config";
import { queryNearestBoats } from "@/ai/vertexSearchGroundingService";
import { logger } from "@/logger/logger";

export const retrieveBoatsTool = ai.defineTool(
    {
        name: "retrieveNearestRescueBoats",
        description: "Use this tool to find the nearest available rescue boats when a distress signal indicates a high severity flood or explicitly requests a boat evacuation.",
        inputSchema: z.object({
            location_name: z.string().describe("The name of the district or location extracted from the user's message"),
            lat: z.number().describe("The latitude of the user"),
            lng: z.number().describe("The longitude of the user"),
        }),
        outputSchema: z.any(), // Returning the NearestBoat array
    },
    async ({ location_name, lat, lng }) => {
        logger.info(`[retrieveBoatsTool] Genkit triggered boat search for ${location_name}`);
        const boats = await queryNearestBoats(location_name, { lat, lng });
        return boats;
    }
);