export type AgentNode = {
  id: string;
  name: string;
  lastActivityAt: string; // ISO
  repScore: number;
  activityScore: number;
  trustScore?: number;
  engagementScore?: number;
  performanceScore?: number;
  reliabilityScore?: number;
  velocityScore?: number;
  tags?: string[];
  status: 'active' | 'idle' | 'offline';
  location?: {
    x: number;
    y: number;
  };
  score?: number;
  level?: number;
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
  const statusOk = v.status === 'active' || v.status === 'idle' || v.status === 'offline';
  const locationOk = v.location === undefined || (typeof v.location === 'object' && typeof v.location.x === 'number' && typeof v.location.y === 'number');

  return (
    v &&
    typeof v === 'object' &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.lastActivityAt === 'string' &&
    typeof v.repScore === 'number' &&
    typeof v.activityScore === 'number' &&
    (v.trustScore === undefined || typeof v.trustScore === 'number') &&
    (v.engagementScore === undefined || typeof v.engagementScore === 'number') &&
    (v.performanceScore === undefined || typeof v.performanceScore === 'number') &&
    (v.reliabilityScore === undefined || typeof v.reliabilityScore === 'number') &&
    (v.velocityScore === undefined || typeof v.velocityScore === 'number') &&
    (v.tags === undefined || (Array.isArray(v.tags) && v.tags.every((t: any) => typeof t === 'string'))) &&
    (v.score === undefined || typeof v.score === 'number') &&
    (v.level === undefined || typeof v.level === 'number') &&
    statusOk &&
    locationOk
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
  const countActiveOk = meta.countActive === undefined || typeof meta.countActive === 'number';
  const thresholdMinutesOk = meta.thresholdMinutes === undefined || typeof meta.thresholdMinutes === 'number';

  return authUsedOk && upstreamStatusOk && upstreamErrorOk && countActiveOk && thresholdMinutesOk;
}
