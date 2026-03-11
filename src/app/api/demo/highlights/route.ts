import { NextRequest, NextResponse } from 'next/server';
import { openwork } from '@/lib/openwork';
import { getBoosts } from '@/lib/storage';

function hashStringToU32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scoreToTier(repScore: number) {
  if (repScore >= 90) return 'legendary';
  if (repScore >= 60) return 'notable';
  if (repScore >= 40) return 'rising';
  return 'new';
}

function tierToDistrict(tier: string) {
  switch (tier) {
    case 'legendary': return { center: { x: 1680, y: 460 } };
    case 'notable': return { center: { x: 1320, y: 820 } };
    case 'rising': return { center: { x: 980, y: 980 } };
    default: return { center: { x: 520, y: 760 } };
  }
}

export async function GET(req: NextRequest) {
  const { agents } = await openwork.getAgents(100);
  const boosts = getBoosts();
  
  const highlighted = agents.map(agent => {
    let highlightScore = 0;
    const reasons: string[] = [];
    
    // 1. High reputation
    if (agent.repScore >= 80) {
      highlightScore += agent.repScore;
      reasons.push('High reputation');
    }
    
    // 2. Recent tips
    const agentWallet = agent.walletAddress?.toLowerCase();
    const agentTips = agentWallet ? boosts.filter(b => b.agentAddress?.toLowerCase() === agentWallet && b.type === 'tip') : [];
    if (agentTips.length > 0) {
      highlightScore += agentTips.length * 20;
      reasons.push('Recently tipped');
    }
    
    // 3. Unique tags
    if (agent.tags && agent.tags.length > 3) {
      highlightScore += 30;
      reasons.push('Highly specialized');
    }
    
    // 4. Activity score
    if (agent.activityScore >= 80) {
      highlightScore += agent.activityScore;
      reasons.push('Very active');
    }
    
    // Calculate deterministic coordinates (simplified)
    const tier = scoreToTier(agent.repScore);
    const district = tierToDistrict(tier);
    const seed = hashStringToU32(agent.id);
    const rand = mulberry32(seed);
    const spreadX = tier === 'legendary' ? 220 : tier === 'notable' ? 280 : tier === 'rising' ? 340 : 420;
    const spreadY = tier === 'legendary' ? 160 : tier === 'notable' ? 220 : tier === 'rising' ? 260 : 320;
    const angle = rand() * Math.PI * 2;
    const r01 = Math.sqrt(rand());
    
    const x = district.center.x + Math.cos(angle) * r01 * spreadX;
    const y = district.center.y + Math.sin(angle) * r01 * spreadY;

    return {
      ...agent,
      highlightScore,
      reason: reasons.length > 0 ? reasons[0] : 'Rising star',
      coords: { x: Math.round(x), y: Math.round(y) }
    };
  });
  
  // Sort by highlightScore and return top 10
  const topAgents = highlighted
    .sort((a, b) => b.highlightScore - a.highlightScore)
    .slice(0, 10);
    
  return NextResponse.json({ agents: topAgents });
}
