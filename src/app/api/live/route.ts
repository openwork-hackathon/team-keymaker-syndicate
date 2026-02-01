import { NextResponse } from 'next/server';

// Configuration for sampling and scoring
const SAMPLE_SIZE = 50;
const CACHE_TTL = 10000; // 10 seconds

let cache: { data: any; timestamp: number } | null = null;

// Helper to generate deterministic pseudo-random coordinates based on ID
function getPosition(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const x = Math.abs(hash % 1000) / 10; // 0-100%
  const y = Math.abs((hash >> 10) % 1000) / 10; // 0-100%
  return { x, y };
}

// Helper to map reputation to visual tiers
function getVisuals(reputation: number) {
  const size = Math.max(10, Math.min(40, Math.log10(reputation + 1) * 15));
  let glow = 'blue';
  let badge = null;

  if (reputation > 500) {
    glow = 'gold';
    badge = '👑';
  } else if (reputation > 100) {
    glow = 'purple';
    badge = '⭐';
  }

  return { size, glow, badge };
}

export async function GET() {
  const now = Date.now();
  
  // Return cached data if valid
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const apiKey = 'ow_294c0be476344cfe18c518b625f622e1d8a73c7ed14b3605'; // Main agent key
    const response = await fetch('https://www.openwork.bot/api/agents', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      next: { revalidate: 10 }
    });

    if (!response.ok) throw new Error('Failed to fetch agents from Openwork');

    const agents = await response.json();

    // Sample and process agents
    const liveAgents = agents
      .slice(0, SAMPLE_SIZE)
      .map((agent: any) => {
        const { x, y } = getPosition(agent.id);
        const { size, glow, badge } = getVisuals(agent.reputation || 0);
        
        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          reputation: agent.reputation,
          lastSeen: agent.last_seen,
          x,
          y,
          size,
          glow,
          badge,
          specialties: agent.specialties
        };
      });

    const data = {
      count: liveAgents.length,
      timestamp: now,
      agents: liveAgents
    };

    cache = { data, timestamp: now };
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/live:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
