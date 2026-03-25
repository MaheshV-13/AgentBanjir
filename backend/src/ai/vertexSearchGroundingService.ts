/**
 * @module ai/vertexSearchGroundingService
 *
 * Queries the Vertex AI Search (Discovery Engine) data store to retrieve
 * the nearest available rescue boats for a given location string.
 *
 * This module is the RAG grounding layer (SDD §5.3). It is called by
 * SignalOrchestrator after Gemini extraction, using the `location` field
 * as the semantic search query.
 *
 * ── Field mapping note (CSV → NearestBoat interface) ─────────────────────────
 * The rescue boat CSV has 5 columns: boat_id, district, lat, lng, capacity.
 * The NearestBoat interface (signal.types.ts) requires: boat_id, name,
 * distance_km, capacity, current_status.
 *
 * Mappings applied here:
 *   name           → "Rescue Unit — {district}"  (no raw name field in CSV)
 *   distance_km    → computed via Haversine formula (signal GPS vs boat GPS)
 *   current_status → mapped from ingested `status` field:
 *                      "Available" → "Available"
 *                      "Deployed"  → "Deployed"
 *                      "Offline"   → "Maintenance"  (closest semantic match)
 *
 * ── Graceful degradation ──────────────────────────────────────────────────────
 * If this service throws, SignalOrchestrator catches it and returns
 * nearest_boats: [] — the gateway degrades gracefully without crashing.
 */

import { SearchServiceClient }  from "@google-cloud/discoveryengine";
import { logger }                from "@/logger/logger";
import type { NearestBoat }      from "@/types/signal.types";
import type { GpsCoordinates }   from "@/types/signal.types";

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Reads Vertex AI Search connection parameters from the environment.
 * These should be configured in the project's @/config/env module and
 * exposed via process.env in Cloud Run.
 *
 * Required env vars:
 *   GCP_PROJECT_ID          — GCP project hosting the Discovery Engine instance
 *   GCP_LOCATION            — Region for Discovery Engine (default: "global")
 *   VERTEX_DATA_STORE_ID    — The data store ID created during CSV ingestion
 */
function getVertexConfig(): {
  projectId:   string;
  location:    string;
  dataStoreId: string;
} {
  const projectId   = process.env["GCP_PROJECT_ID"]?.trim();
  const location    = process.env["GCP_LOCATION"]?.trim()         ?? "global";
  const dataStoreId = process.env["VERTEX_DATA_STORE_ID"]?.trim();

  if (!projectId)   throw new Error("GCP_PROJECT_ID env var is not set.");
  if (!dataStoreId) throw new Error("VERTEX_DATA_STORE_ID env var is not set.");

  return { projectId, location, dataStoreId };
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum boats to retrieve per query — top-3 per SDD §8.2. */
const MAX_BOATS = 3;

/**
 * Filter applied to every Discovery Engine query.
 * Only boats in "Available" status are considered for dispatch recommendations.
 */
const AVAILABILITY_FILTER = `status: ANY("Available")`;

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Computes the great-circle distance in kilometres between two GPS points
 * using the Haversine formula.
 *
 * @param from - The signal's GPS coordinates (victim location).
 * @param toLat - Boat's latitude from the data store.
 * @param toLng - Boat's longitude from the data store.
 * @returns Distance in kilometres, rounded to 2 decimal places.
 */
function haversineKm(
  from:  GpsCoordinates,
  toLat: number,
  toLng: number
): number {
  const R      = 6371; // Earth mean radius in km
  const dLat   = ((toLat - from.lat) * Math.PI) / 180;
  const dLng   = ((toLng - from.lng) * Math.PI) / 180;
  const latRad = (from.lat * Math.PI) / 180;
  const toLatR = (toLat   * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latRad) * Math.cos(toLatR) * Math.sin(dLng / 2) ** 2;

  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(km * 100) / 100;
}

/**
 * Maps an ingested `status` string to the NearestBoat `current_status` enum.
 * The CSV uses "Offline"; the interface only accepts "Maintenance" as the
 * equivalent inactive state — so we normalise here.
 *
 * @param rawStatus - The status string from the data store struct_data.
 * @returns A valid NearestBoat current_status value.
 */
function mapBoatStatus(
  rawStatus: string
): NearestBoat["current_status"] {
  const map: Record<string, NearestBoat["current_status"]> = {
    Available:   "Available",
    Deployed:    "Deployed",
    Offline:     "Maintenance",
    Maintenance: "Maintenance",
  };
  // Default to "Maintenance" for unknown status values — safe, non-dispatching.
  return map[rawStatus] ?? "Maintenance";
}

/**
 * Converts a raw Discovery Engine document struct into a NearestBoat object.
 *
 * @param structData  - Raw struct_data from the Discovery Engine document.
 * @param signalGps   - The victim's GPS coordinates for distance computation.
 * @returns A fully-typed NearestBoat, or null if required fields are missing.
 */
function mapDocumentToBoat(
  structData:  Record<string, unknown>,
  signalGps:   GpsCoordinates
): NearestBoat | null {
  const boat_id  = structData["boat_id"]  as string  | undefined;
  const district = structData["district"] as string  | undefined;
  const lat      = structData["lat"]      as number  | undefined;
  const lng      = structData["lng"]      as number  | undefined;
  const capacity = structData["capacity"] as number  | undefined;
  const status   = structData["status"]   as string  | undefined;

  // Guard: all fields must be present for a usable boat record.
  if (!boat_id || !district || lat == null || lng == null || !capacity) {
    logger.warn("[VertexSearchGroundingService] Skipping incomplete boat record", {
      boat_id,
      district,
    });
    return null;
  }

  return {
    boat_id,
    // "name" field does not exist in the 5-column CSV.
    // We synthesise a human-readable label from the district for the dashboard.
    name:           `Rescue Unit — ${district}`,
    distance_km:    haversineKm(signalGps, lat, lng),
    capacity:       Math.round(capacity),
    current_status: mapBoatStatus(status ?? ""),
  };
}

// ─── Core Service Function ────────────────────────────────────────────────────

/**
 * Queries Vertex AI Search for the nearest available rescue boats to a location.
 *
 * Uses a hybrid strategy (SDD §8.2):
 *   - Semantic query: the extracted location string for intent-based matching.
 *   - Structured filter: status = "Available" to exclude deployed/offline boats.
 *
 * @param location  - Location string extracted by Gemini (e.g., "Kampung Gajah").
 *                    If null (Gemini could not extract), returns empty array.
 * @param signalGps - Victim's GPS coordinates for computing distance_km.
 * @returns Array of up to 3 NearestBoat objects, sorted by Vertex relevance score.
 *          Returns [] on empty results or if location is null.
 *
 * @throws {Error} On Discovery Engine API failure (caught by SignalOrchestrator).
 */
export async function queryNearestBoats(
  location:   string | null,
  signalGps:  GpsCoordinates
): Promise<NearestBoat[]> {
  // If Gemini couldn't extract a location, we have no meaningful query term.
  // Return empty — the gateway renders the signal without boat recommendations.
  if (!location) {
    logger.warn(
      "[VertexSearchGroundingService] No location extracted — skipping RAG query."
    );
    return [];
  }

  const { projectId, location: gcpLocation, dataStoreId } = getVertexConfig();

  const client         = new SearchServiceClient();
  const servingConfig  = [
    `projects/${projectId}`,
    `locations/${gcpLocation}`,
    "collections/default_collection",
    `dataStores/${dataStoreId}`,
    "servingConfigs/default_config",
  ].join("/");

  logger.debug("[VertexSearchGroundingService] Querying Discovery Engine", {
    location,
    filter: AVAILABILITY_FILTER,
    max_results: MAX_BOATS,
  });

  const [response] = await client.search({
    servingConfig,
    query:    location,
    filter:   AVAILABILITY_FILTER,
    pageSize: MAX_BOATS,
  });

  const results = response.results ?? [];

  if (results.length === 0) {
    logger.warn("[VertexSearchGroundingService] No available boats found", {
      location,
    });
    return [];
  }

  // Map Discovery Engine documents to typed NearestBoat objects.
  // Documents with missing fields are filtered out via the null guard in mapDocumentToBoat.
  const boats: NearestBoat[] = results
    .map((result) => {
      const structData = result.document?.structData?.fields
        ? Object.fromEntries(
            Object.entries(result.document.structData.fields).map(([k, v]) => [
              k,
              // Extract scalar values from Protobuf Value wrappers.
              v.stringValue ?? v.numberValue ?? v.boolValue ?? null,
            ])
          )
        : {};
      return mapDocumentToBoat(structData as Record<string, unknown>, signalGps);
    })
    .filter((boat): boat is NearestBoat => boat !== null);

  logger.debug("[VertexSearchGroundingService] Boats retrieved", {
    location,
    boats_found: boats.length,
  });

  return boats;
}
