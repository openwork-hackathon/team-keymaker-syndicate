import type { AgentNode } from './types';

export interface OpenworkClientMeta {
  authUsed: boolean;
  upstreamStatus?: number;
  upstreamError?: string;
  totalAgents?: number;
  countActive?: number;
  thresholdMinutes?: number;
  sampledCount?: number;
  samplingHour?: number;
}

export interface OpenworkAgentsResponse {
  agents: AgentNode[];
  meta: OpenworkClientMeta;
}

const OPENWORK_API_BASE = 'https://www.openwork.bot/api';

// Threshold for considering an agent "active" (in minutes)
const ACTIVE_THRESHOLD_MINUTES = 60;

/**
 * Simple seeded random number generator for deterministic sampling.
 * Uses a Linear Congruential Generator (LCG) algorithm.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Deterministically sample agents to keep the map stable between polls.
 * Seed is based on current hour so map stays consistent within each hour.
 */
function deterministicSample<T>(items: T[], limit: number, seed: number): T[] {
  if (items.length <= limit) return items;
  
  const random = seededRandom(seed);
  const shuffled = [...items];
  
  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, limit);
}

export class OpenworkClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENWORK_API_KEY;
  }

  async getAgents(limit = 50): Promise<OpenworkAgentsResponse> {
    const meta: OpenworkClientMeta = {
      authUsed: Boolean(this.apiKey),
      thresholdMinutes: ACTIVE_THRESHOLD_MINUTES,
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

      const rawAgents: unknown = await response.json();
      if (!Array.isArray(rawAgents)) {
        meta.upstreamError = 'Openwork API returned a non-array JSON payload';
        return { agents: [], meta };
      }

      meta.totalAgents = rawAgents.length;

      const now = Date.now();
      const thresholdMs = ACTIVE_THRESHOLD_MINUTES * 60 * 1000;

      // Filter to only include agents with valid data
      const validAgents = rawAgents.filter(
        (a: any) => a && typeof a === 'object' && a.last_seen
      );

      // Separate active agents (within threshold) from inactive
      const activeAgents = validAgents.filter((a: any) => {
        const lastSeen = new Date(a.last_seen).getTime();
        return now - lastSeen <= thresholdMs;
      });

      const inactiveAgents = validAgents.filter((a: any) => {
        const lastSeen = new Date(a.last_seen).getTime();
        return now - lastSeen > thresholdMs;
      });

      meta.countActive = activeAgents.length;

      // Sort active agents by last_seen (most recent first)
      activeAgents.sort(
        (a: any, b: any) => 
          new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      );

      // Sort inactive agents by reputation (highest first) as fallback
      inactiveAgents.sort(
        (a: any, b: any) => (b.reputation ?? 0) - (a.reputation ?? 0)
      );

      // Prioritize active agents, fill remainder with top inactive
      let selectedAgents: any[];
      
      if (activeAgents.length >= limit) {
        // More active agents than limit: sample deterministically
        const currentHour = Math.floor(now / (1000 * 60 * 60));
        meta.samplingHour = currentHour;
        selectedAgents = deterministicSample(activeAgents, limit, currentHour);
      } else {
        // Take all active + fill with inactive (sorted by reputation)
        const remainingSlots = limit - activeAgents.length;
        selectedAgents = [
          ...activeAgents,
          ...inactiveAgents.slice(0, remainingSlots)
        ];
      }

      meta.sampledCount = selectedAgents.length;

      // Map to AgentNode type
      const agents: AgentNode[] = selectedAgents.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        lastActivityAt: agent.last_seen,
        repScore: agent.reputation ?? 50,
        activityScore: agent.jobs_completed > 0 ? 70 : 30,
        tags: agent.specialties || [],
      }));

      return { agents, meta };
    } catch (error) {
      meta.upstreamError = error instanceof Error ? error.message : String(error);
      console.error('Error fetching agents from Openwork:', error);
      return { agents: [], meta };
    }
  }
}

export const openwork = new OpenworkClient();
