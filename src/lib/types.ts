export type AgentNode = {
  id: string;
  name: string;
  lastActivityAt: string; // ISO
  repScore: number;
  activityScore: number;
  vibeScore: number;
  tags?: string[];
  jobsCompleted?: number;
  speedScore?: number;
  tier?: string;
  walletAddress?: string;
};

export type LiveResponse = {
  generatedAt: string; // ISO
  agents: AgentNode[];
  meta?: {
    authUsed?: boolean;
    upstreamStatus?: number;
    upstreamError?: string;
    countActive?: number;
    thresholdMinutes?: number;
  };
};

// Lightweight runtime validation (no external deps)
export function isAgentNode(v: any): v is AgentNode {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.lastActivityAt === 'string' &&
    typeof v.repScore === 'number' &&
    typeof v.activityScore === 'number' &&
    typeof v.vibeScore === 'number' &&
    (v.walletAddress === undefined || typeof v.walletAddress === 'string') &&
    (v.tags === undefined || (Array.isArray(v.tags) && v.tags.every((t: any) => typeof t === 'string'))) &&
    (v.jobsCompleted === undefined || typeof v.jobsCompleted === 'number') &&
    (v.speedScore === undefined || typeof v.speedScore === 'number') &&
    (v.tier === undefined || typeof v.tier === 'string')
  );
}

export function isLiveResponse(v: any): v is LiveResponse {
  if (
    !(
      v &&
      typeof v === 'object' &&
      typeof v.generatedAt === 'string' &&
      Array.isArray((v as any).agents) &&
      (v as any).agents.every(isAgentNode)
    )
  ) {
    return false;
  }

  const meta = (v as any).meta;
  if (meta === undefined) return true;
  if (!meta || typeof meta !== 'object') return false;

  const authUsedOk = meta.authUsed === undefined || typeof meta.authUsed === 'boolean';
  const upstreamStatusOk = meta.upstreamStatus === undefined || typeof meta.upstreamStatus === 'number';
  const upstreamErrorOk = meta.upstreamError === undefined || typeof meta.upstreamError === 'string';

  return authUsedOk && upstreamStatusOk && upstreamErrorOk;
}
