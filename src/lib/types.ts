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
