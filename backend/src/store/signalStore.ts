/**
 * @module store/signalStore
 *
 * Prisma-backed PostgreSQL implementation of the signal store.
 * Replaces the legacy InMemorySignalStore for production persistence.
 */
import { PrismaClient } from "@prisma/client";
import type { 
  EnrichedSignal, 
  SeverityLevel, 
  SignalStatus,
  NearestBoat,
  FlowResult 
} from "@/types/signal.types";
import type { StoreHealthSnapshot } from "@/store/signalStore.types";

const prisma = new PrismaClient();

// ─── Data Mappers ─────────────────────────────────────────────────────────────

/** Maps a Prisma database row back to the exact EnrichedSignal interface */
function mapDbToSignal(dbRow: any): EnrichedSignal {
  return {
    id: dbRow.id,
    gps_coordinates: {
      lat: dbRow.lat,
      lng: dbRow.lng,
    },
    severity_level:      dbRow.severityLevel as SeverityLevel,
    ai_confidence_score: dbRow.aiConfidenceScore,
    specific_needs:      dbRow.specificNeeds,
    status:              dbRow.status as SignalStatus,
    created_at:          dbRow.createdAt.toISOString(),
    updated_at:          dbRow.updatedAt.toISOString(),
    // Safely cast the JSONB fields back to their TypeScript interfaces
    nearest_boats:       dbRow.nearestBoats ? (dbRow.nearestBoats as NearestBoat[]) : undefined,
    flow_result:         dbRow.flowResult ? (dbRow.flowResult as FlowResult) : undefined,
  };
}

// ─── Prisma Implementation ────────────────────────────────────────────────────

class PrismaSignalStore {
  
  async getAll(): Promise<EnrichedSignal[]> {
    const signals = await prisma.signal.findMany({
      orderBy: { createdAt: "desc" }, // Always return newest first
    });
    return signals.map(mapDbToSignal);
  }

  async getById(id: string): Promise<EnrichedSignal | undefined> {
    const signal = await prisma.signal.findUnique({ where: { id } });
    return signal ? mapDbToSignal(signal) : undefined;
  }

  async upsert(signal: EnrichedSignal): Promise<void> {
    await prisma.signal.upsert({
      where: { id: signal.id },
      update: {
        status:            signal.status,
        updatedAt:         new Date(signal.updated_at),
        nearestBoats:      signal.nearest_boats ? (signal.nearest_boats as any) : null,
        flowResult:        signal.flow_result ? (signal.flow_result as any) : null,
      },
      create: {
        id:                signal.id,
        lat:               signal.gps_coordinates.lat,
        lng:               signal.gps_coordinates.lng,
        severityLevel:     signal.severity_level,
        aiConfidenceScore: signal.ai_confidence_score,
        specificNeeds:     signal.specific_needs,
        status:            signal.status,
        createdAt:         new Date(signal.created_at),
        updatedAt:         new Date(signal.updated_at),
        nearestBoats:      signal.nearest_boats ? (signal.nearest_boats as any) : null,
        flowResult:        signal.flow_result ? (signal.flow_result as any) : null,
      },
    });
  }

  async updateStatus(id: string, status: SignalStatus): Promise<EnrichedSignal | undefined> {
    try {
      const updated = await prisma.signal.update({
        where: { id },
        data: { status },
      });
      return mapDbToSignal(updated);
    } catch (error) {
      // Prisma throws an error if the record to update is not found
      return undefined;
    }
  }

  async count(): Promise<number> {
    return await prisma.signal.count();
  }

  async clear(): Promise<void> {
    await prisma.signal.deleteMany();
  }

  async getHealthSnapshot(): Promise<StoreHealthSnapshot> {
    const signals = await this.getAll();

    const by_severity: Record<SeverityLevel, number> = { High: 0, Medium: 0, Low: 0 };
    const by_status: Record<SignalStatus, number> = {
      Pending_Human_Review: 0,
      Dispatched:           0,
      Rejected:             0,
    };

    for (const signal of signals) {
      by_severity[signal.severity_level] += 1;
      by_status[signal.status]           += 1;
    }

    return {
      total_signals:     signals.length,
      by_severity,
      by_status,
      snapshot_taken_at: new Date().toISOString(),
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const signalStore = new PrismaSignalStore();