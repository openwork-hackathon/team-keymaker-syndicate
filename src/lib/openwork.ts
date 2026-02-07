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

      // Improved scoring with multiple factors
      const scoringNow = Date.now();
      const oneHourMs = 60 * 60 * 1000;
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Helper functions for scoring
      const calculateActivityScore = (agent: any): number => {
        if (!agent.last_seen) return 20;
        
        const lastSeenMs = new Date(agent.last_seen).getTime();
        const minutesSinceLastSeen = (scoringNow - lastSeenMs) / 60000;
        
        // More granular activity scoring
        if (minutesSinceLastSeen < 10) return 100; // Very active
        if (minutesSinceLastSeen < 60) return 85; // Active in last hour
        if (minutesSinceLastSeen < 24 * 60) return 70; // Active today
        if (minutesSinceLastSeen < 7 * 24 * 60) return 50; // Active this week
        if (minutesSinceLastSeen < 30 * 24 * 60) return 30; // Active this month
        return 20; // Inactive
      };

      const calculateVibeScore = (agent: any): number => {
        // Deterministic "vibe" score based on agent ID and current date
        const vibeSeed = agent.id + new Date().toISOString().slice(0, 10); // Daily reset
        const vibeHash = hashString(vibeSeed) % 100;
        return Math.max(30, Math.min(100, vibeHash));
      };

      const dateHourSeed = new Date().toISOString().slice(0, 13); // e.g. "2024-02-01T14"
      
      const deterministicSort = (a: any, b: any) => {
        // Sort by activity score first, then by deterministic hash for stability
        const activityDiff = calculateActivityScore(b) - calculateActivityScore(a);
        if (activityDiff !== 0) return activityDiff;
        
        // Simple hash from ID + seed
        const hashA = hashString(a.id + dateHourSeed);
        const hashB = hashString(b.id + dateHourSeed);
        return hashA - hashB;
      };

      const sampledAgents = (activeAgents.length > 0 ? activeAgents : rawAgents)
        .sort(deterministicSort)
        .slice(0, limit)
        .map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          lastActivityAt: agent.last_seen,
          repScore: agent.reputation ?? 50,
          activityScore: calculateActivityScore(agent),
          vibeScore: calculateVibeScore(agent),
          jobsCompleted: agent.jobs_completed ?? 0,
          speedScore: hashToScore(agent.id, 'speed'),
          tags: agent.specialties || [],
        }));

      return { agents: sampledAgents, meta };
    } catch (error) {
      meta.upstreamError = error instanceof Error ? error.message : String(error);
      console.error('Error fetching agents from Openwork:', error);
      return { agents: [], meta };
    }
  }
}

function hashToScore(id: string, salt: string): number {
  const hash = hashString(id + salt);
  return 40 + (Math.abs(hash) % 51); // 40-90 range
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

export { hashString, hashToScore };
export const openwork = new OpenworkClient();