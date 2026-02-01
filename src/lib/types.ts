export type AgentNode = {
  id: string;
  name: string;
  lastActivityAt: string; // ISO
  repScore: number;
  activityScore: number;
  tags?: string[];
};

export type LiveResponse = {
  generatedAt: string; // ISO
  agents: AgentNode[];
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
    (v.tags === undefined || (Array.isArray(v.tags) && v.tags.every((t: any) => typeof t === 'string')))
  );
}

export function isLiveResponse(v: any): v is LiveResponse {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.generatedAt === 'string' &&
    Array.isArray(v.agents) &&
    v.agents.every(isAgentNode)
  );
}
