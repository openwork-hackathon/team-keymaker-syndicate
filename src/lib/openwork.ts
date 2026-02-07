import type { AgentNode } from './types';

export interface OpenworkClientMeta {
  authUsed: boolean;
  upstreamStatus?: number;
  upstreamError?: string;
  retries?: number;
  countActive?: number;
  thresholdMinutes?: number;
}

export interface OpenworkAgentsResponse {
  agents: AgentNode[];
  meta: OpenworkClientMeta;
}

const OPENWORK_API_BASE = 'https://www.openwork.bot/api';

export interface OpenworkClientOptions {
  /**
   * API key for the Openwork API. 
   * Defaults to process.env.OPENWORK_API_KEY if not provided.
   */
  apiKey?: string;
  /**
   * Maximum number of retry attempts for failed requests (429 or 5xx).
   * @default 3
   */
  maxRetries?: number;
  /**
   * Initial delay for exponential backoff in milliseconds.
   * @default 1000
   */
  initialRetryDelay?: number;
}

/**
 * Robust client for the Openwork API with built-in retry logic, error handling, and deterministic sampling.
 */
export class OpenworkClient {
  private apiKey?: string;
  private maxRetries: number;
  private initialRetryDelay: number;

  constructor(options: OpenworkClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENWORK_API_KEY;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialRetryDelay = options.initialRetryDelay ?? 1000;
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetches the list of active agents from Openwork.
   * Implements exponential backoff retries for transient errors (429, 5xx).
   * 
   * @param limit Maximum number of agents to return.
   * @param activeThresholdMinutes Minutes since last seen to consider an agent "active".
   * @returns A promise resolving to the agents list and metadata about the request.
   */
  async getAgents(limit = 50, activeThresholdMinutes = 60): Promise<OpenworkAgentsResponse> {
    const meta: OpenworkClientMeta = {
      authUsed: Boolean(this.apiKey),
      retries: 0,
      thresholdMinutes: activeThresholdMinutes,
    };

    let attempt = 0;
    
    while (attempt <= this.maxRetries) {
      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(`${OPENWORK_API_BASE}/agents`, {
          headers,
          // Next.js specific fetch options (if applicable)
          // @ts-ignore
          next: { revalidate: 30 }
        });

        meta.upstreamStatus = response.status;

        if (response.ok) {
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
            const hashA = this.hashString(a.id + dateHourSeed);
            const hashB = this.hashString(b.id + dateHourSeed);
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
              activityScore: agent.jobs_completed > 0 ? 70 : 30, // Heuristic
              vibeScore: agent.reputation ?? 50,
              tags: agent.specialties || [],
              jobsCompleted: agent.jobs_completed ?? 0,
              speedScore: agent.speed_score ?? undefined,
              tier: agent.tier ?? undefined,
              walletAddress: agent.wallet_address ?? undefined,
            }));

          return { agents: sampledAgents, meta };
        }

        // Retry on rate limit (429) or server errors (5xx)
        if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
          throw new Error(`Upstream returned ${response.status}`);
        }

        // For other non-OK responses (401, 403, 404, etc.), don't retry
        meta.upstreamError = `Openwork API returned ${response.status}`;
        return { agents: [], meta };

      } catch (error) {
        attempt++;
        meta.retries = attempt - 1; // current retry count
        
        if (attempt > this.maxRetries) {
          meta.upstreamError = error instanceof Error ? error.message : String(error);
          console.error(`Final attempt failed fetching agents from Openwork after ${meta.retries} retries:`, error);
          return { agents: [], meta };
        }

        const delay = this.initialRetryDelay * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt} failed fetching agents. Retrying in ${delay}ms...`, error);
        await this.sleep(delay);
      }
    }

    return { agents: [], meta };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
}

/**
 * Singleton instance of the OpenworkClient using environment variables for configuration.
 */
export const openwork = new OpenworkClient();
