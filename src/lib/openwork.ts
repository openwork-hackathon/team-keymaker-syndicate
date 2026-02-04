import type { AgentNode } from './types';

export interface OpenworkClientMeta {
  authUsed: boolean;
  upstreamStatus?: number;
  upstreamError?: string;
  countActive?: number;
  thresholdMinutes?: number;
}

export interface OpenworkAgentsResponse {
  agents: AgentNode[];
  meta: OpenworkClientMeta;
}

const OPENWORK_API_BASE = 'https://www.openwork.bot/api';

export class OpenworkClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENWORK_API_KEY;
  }

  async getAgents(limit = 50, activeThresholdMinutes = 60): Promise<OpenworkAgentsResponse> {
    const meta: OpenworkClientMeta = {
      authUsed: Boolean(this.apiKey),
      thresholdMinutes: activeThresholdMinutes,
    };

    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${OPENWORK_API_BASE}/agents`, {
        headers,
        // We use the default fetch behavior but we can expose tags/revalidate if needed
        next: { revalidate: 30 }
      });

      meta.upstreamStatus = response.status;

      if (!response.ok) {
        meta.upstreamError = `Openwork API returned ${response.status}`;
        return { agents: [], meta };
      }

      const rawAgents: any[] = await response.json();
      if (!Array.isArray(rawAgents)) {
        meta.upstreamError = 'Openwork API returned a non-array JSON payload';
        return { agents: [], meta };
      }

      const now = Date.now();
      const thresholdMs = activeThresholdMinutes * 60 * 1000;

      // Filter and count truly active agents
      const activeAgents = rawAgents.filter((a: any) => {
        if (!a || !a.last_seen) return false;
        const lastSeenMs = new Date(a.last_seen).getTime();
        return (now - lastSeenMs) <= thresholdMs;
      });

      meta.countActive = activeAgents.length;

  // Deterministic sampling seeded by date + hour
      // This keeps the "live map" stable for an hour if multiple polls occur
      const dateHourSeed = new Date().toISOString().slice(0, 13); // e.g. "2024-02-01T14"
      
      const deterministicSort = (a: any, b: any) => {
        // Simple hash from ID + seed
        const hashA = hashString(a.id + dateHourSeed);
        const hashB = hashString(b.id + dateHourSeed);
        return hashA - hashB;
      };

      const baseList = activeAgents.length > 0 ? activeAgents : rawAgents;
      const sampledAgents = baseList
        .sort(deterministicSort)
        .slice(0, limit)
        .map((agent: any) => {
          // Heuristic for activity score: weighted combination of jobs and volume
          const volumeFactor = Math.min(100, (agent.volume || 0) / 10);
          const jobsFactor = Math.min(100, (agent.jobs_completed || 0) * 10);
          const computedActivityScore = Math.max(10, Math.round((volumeFactor + jobsFactor) / 2));

          return {
            id: agent.id,
            name: agent.name,
            lastActivityAt: agent.last_seen,
            repScore: agent.reputation ?? 50,
            activityScore: computedActivityScore,
            jobsCompleted: agent.jobs_completed || 0,
            totalVolume: agent.volume || 0,
            tags: agent.specialties || [],
          };
        });

      return { agents: sampledAgents, meta };
    } catch (error) {
      meta.upstreamError = error instanceof Error ? error.message : String(error);
      console.error('Error fetching agents from Openwork:', error);
      return { agents: [], meta };
    }
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export const openwork = new OpenworkClient();
