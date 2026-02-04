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

  async getAgents(limit = 50, tags: string[] = []): Promise<OpenworkAgentsResponse> {
    const meta: OpenworkClientMeta = {
      authUsed: Boolean(this.apiKey),
    };

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      let url = `${OPENWORK_API_BASE}/agents?limit=${limit}`;
      if (tags.length > 0) {
        url += `&tags=${tags.join(',')}`;
      }

      console.log(`Fetching agents from: ${url}`);

      const response = await fetch(url, {
        headers,
        next: { revalidate: 30 }
      });

      meta.upstreamStatus = response.status;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        meta.upstreamError = `Openwork API returned ${response.status}: ${errorText}`;
        console.error('Upstream error:', meta.upstreamError);
        return { agents: [], meta };
      }

      const rawAgents: any = await response.json();
      
      // Handle the actual API response format which might be wrapped or plain array
      // Based on common patterns, it might be { data: [...] } or [...]
      const agentsList = Array.isArray(rawAgents) ? rawAgents : (rawAgents.data || rawAgents.agents || []);

      if (!Array.isArray(agentsList)) {
        meta.upstreamError = `Openwork API returned a non-array JSON payload: ${JSON.stringify(rawAgents).slice(0, 100)}`;
        console.error('Invalid payload format:', rawAgents);
        return { agents: [], meta };
      }

      // Filter and map to AgentNode
      const agents: AgentNode[] = agentsList
        .filter((a: any) => a && typeof a === 'object')
        .slice(0, limit)
        .map((agent: any) => {
          const rep = agent.reputation ?? agent.repScore ?? agent.rep ?? 50;
          const jobs = agent.jobs_completed ?? agent.activityScore ?? agent.jobsCount ?? 0;
          const activity = jobs > 0 ? Math.min(100, 30 + (jobs * 2)) : 30;
          
          // Generate deterministic location if missing
          let location = agent.location;
          if (!location || typeof location.x !== 'number') {
            const seed = agent.id || agent.name || Math.random().toString();
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
              hash = ((hash << 5) - hash) + seed.charCodeAt(i);
              hash |= 0;
            }
            location = {
              x: Math.abs(hash % 1000) / 10,
              y: Math.abs((hash >> 8) % 1000) / 10
            };
          }

          const trust = agent.trust_score ?? agent.trustScore ?? rep;
          const engagement = agent.engagement_score ?? agent.engagementScore ?? 50;
          const performance = agent.performance_score ?? agent.performanceScore ?? 50;
          const reliability = agent.reliability_score ?? agent.reliabilityScore ?? 50;
          const velocity = agent.velocity_score ?? agent.velocityScore ?? 50;

          const overallScore = agent.overall_score ?? agent.score ?? ((rep + activity + trust + engagement + performance + reliability + velocity) / 7);

          return {
            id: String(agent.id || agent.uuid || `ow-${Math.random().toString(36).substr(2, 9)}`),
            name: agent.name || agent.username || 'Unknown Agent',
            lastActivityAt: agent.last_seen || agent.updatedAt || agent.lastActivityAt || new Date().toISOString(),
            repScore: rep,
            activityScore: activity,
            trustScore: trust,
            engagementScore: engagement,
            performanceScore: performance,
            reliabilityScore: reliability,
            velocityScore: velocity,
            tags: agent.specialties || agent.tags || agent.skills || [],
            status: agent.status || 'active',
            score: overallScore,
            level: agent.level ?? (overallScore > 80 ? 3 : overallScore > 50 ? 2 : 1),
            location
          };
        });

      return { agents, meta };
    } catch (error) {
      meta.upstreamError = error instanceof Error ? error.message : String(error);
      console.error('Error fetching agents from Openwork:', error);
      return { agents: [], meta };
    }
  }
}

export const openwork = new OpenworkClient();
