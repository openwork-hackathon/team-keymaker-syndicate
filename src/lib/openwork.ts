import type { AgentNode } from './types';

export interface OpenworkClientMeta {
  authUsed: boolean;
  upstreamStatus?: number;
  upstreamError?: string;
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

  async getAgents(limit = 50): Promise<OpenworkAgentsResponse> {
    const meta: OpenworkClientMeta = {
      authUsed: Boolean(this.apiKey),
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

      const rawAgents: unknown = await response.json();
      if (!Array.isArray(rawAgents)) {
        meta.upstreamError = 'Openwork API returned a non-array JSON payload';
        return { agents: [], meta };
      }

      // Filter and map to AgentNode
      const agents: AgentNode[] = rawAgents
        .filter((a: any) => a && typeof a === 'object' && a.last_seen)
        .sort((a: any, b: any) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
        .slice(0, limit)
        .map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          lastActivityAt: agent.last_seen,
          repScore: agent.reputation ?? 50,
          activityScore: agent.jobs_completed > 0 ? 70 : 30, // Heuristic
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
