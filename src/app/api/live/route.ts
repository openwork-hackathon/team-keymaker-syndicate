import { NextResponse, NextRequest } from 'next/server';
import type { LiveResponse } from '@/lib/types';
import { openwork } from '@/lib/openwork';

// Caching configuration
const CACHE_TTL = 30; // seconds
let cachedData: LiveResponse | null = null;
let lastFetchTime = 0;

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;
const MAX_IP_RECORDS = 5000; // safety cap to avoid unbounded memory growth
const requestCounts = new Map<string, { count: number; expiresAt: number }>();

function getClientIp(req: NextRequest): string {
  // In Vercel/Proxies, x-forwarded-for can be a comma-separated list.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  // NextRequest.ip is sometimes available depending on runtime.
  const direct = (req as any).ip as string | undefined;
  return direct || 'anonymous';
}

function sweepExpired(now: number) {
  // Opportunistic cleanup
  for (const [ip, record] of requestCounts) {
    if (now > record.expiresAt) requestCounts.delete(ip);
  }
  // Hard cap safety net
  if (requestCounts.size > MAX_IP_RECORDS) {
    // Drop everything to protect the process; rate limiting is best-effort.
    requestCounts.clear();
  }
}

function isRateLimited(ip: string, now: number): boolean {
  const record = requestCounts.get(ip);

  if (!record || now > record.expiresAt) {
    requestCounts.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_REQUESTS) return true;

  record.count += 1;
  return false;
}

export async function GET(req: NextRequest) {
  const now = Date.now();
  sweepExpired(now);

  const ip = getClientIp(req);
  if (isRateLimited(ip, now)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Simple in-memory cache check
  if (cachedData && (now - lastFetchTime) < CACHE_TTL * 1000) {
    return NextResponse.json(cachedData);
  }

  // Sample data for active agents to provide "live" feel
  const activeAgentsSample = [
    { id: 'agent-777', name: 'Lucky Seven', status: 'active', x: 45.5, y: 12.3, score: 98, level: 5, reputation: 95, jobs: 42, trust: 97, engagement: 99, performance: 98, reliability: 99, velocity: 95, tags: ['top-rated', 'verified', 'fast'] },
    { id: 'agent-001', name: 'Prime', status: 'active', x: 22.1, y: 88.4, score: 92, level: 4, reputation: 90, jobs: 35, trust: 92, engagement: 94, performance: 90, reliability: 95, velocity: 88, tags: ['pioneer', 'core'] },
    { id: 'agent-999', name: 'Enigma', status: 'active', x: 77.2, y: 45.9, score: 85, level: 3, reputation: 82, jobs: 28, trust: 88, engagement: 82, performance: 85, reliability: 80, velocity: 92, tags: ['mystery', 'specialist'] },
    { id: 'agent-404', name: 'Ghost', status: 'active', x: 10.5, y: 65.2, score: 77, level: 2, reputation: 75, jobs: 15, trust: 80, engagement: 77, performance: 75, reliability: 85, velocity: 70, tags: ['stealth', 'ninja'] },
    { id: 'agent-200', name: 'Success', status: 'active', x: 88.8, y: 15.1, score: 99, level: 5, reputation: 98, jobs: 50, trust: 99, engagement: 100, performance: 99, reliability: 99, velocity: 98, tags: ['elite', 'expert'] },
    { id: 'agent-alpha', name: 'Alpha Solver', status: 'active', x: 33.3, y: 33.3, score: 91, level: 4, reputation: 89, jobs: 31, trust: 90, engagement: 92, performance: 88, reliability: 94, velocity: 85, tags: ['backend', 'problem-solver'] },
    { id: 'agent-beta', name: 'Beta Tester', status: 'active', x: 66.6, y: 66.6, score: 88, level: 3, reputation: 85, jobs: 25, trust: 86, engagement: 88, performance: 84, reliability: 88, velocity: 82, tags: ['frontend', 'quality'] }
  ];

  const searchParams = req.nextUrl.searchParams;
  const filterTags = searchParams.getAll('tags');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const { agents, meta } = await openwork.getAgents(limit, filterTags);

  // Mix in sample agents if not present in the upstream
  const sampleAgentsWithScores = activeAgentsSample.map(sample => {
    // Deterministic but dynamic movement for sample agents
    const movementOffset = (now % 3600000) / 3600000 * 2 * Math.PI;
    const dynamicX = Math.min(100, Math.max(0, sample.x + Math.sin(movementOffset + sample.id.length) * 2));
    const dynamicY = Math.min(100, Math.max(0, sample.y + Math.cos(movementOffset + sample.id.length) * 2));

    return {
      id: sample.id,
      name: sample.name,
      lastActivityAt: new Date(now).toISOString(),
      repScore: sample.reputation,
      activityScore: sample.jobs,
      trustScore: sample.trust,
      engagementScore: sample.engagement,
      performanceScore: sample.performance,
      reliabilityScore: sample.reliability,
      velocityScore: sample.velocity,
      status: 'active' as const,
      location: { x: dynamicX, y: dynamicY },
      tags: sample.tags,
      score: sample.score,
      level: sample.level
    };
  });

  const allAgents = [...agents];
  sampleAgentsWithScores.forEach(sample => {
    // If we have filterTags, only include sample if it matches at least one tag
    if (filterTags.length > 0 && !sample.tags?.some(t => filterTags.includes(t))) {
      return;
    }

    const existingIndex = allAgents.findIndex(a => a.id === sample.id);
    if (existingIndex === -1) {
      allAgents.push(sample);
    } else {
      // Merge sample data with upstream data, preferring sample's "active" state and coordinates
      allAgents[existingIndex] = {
        ...allAgents[existingIndex],
        ...sample,
        tags: Array.from(new Set([...(allAgents[existingIndex].tags || []), ...(sample.tags || [])])),
      };
    }
  });

  // Filter for 'active now'
  const activeThresholdMinutes = parseInt(searchParams.get('threshold') || '60', 10);
  const activeThresholdMs = activeThresholdMinutes * 60 * 1000;
  const activeAgents = allAgents.filter(a => {
    const lastSeen = new Date(a.lastActivityAt).getTime();
    return (now - lastSeen) < activeThresholdMs;
  });

  // Deterministic sampling
  const dateObj = new Date(now);
  const seed = `${dateObj.getUTCFullYear()}-${dateObj.getUTCMonth()}-${dateObj.getUTCDate()}-${dateObj.getUTCHours()}`;
  
  function seededRandom(s: string) {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
  }

  // Shuffle with seed
  const shuffled = [...activeAgents].sort((a, b) => {
    const ra = seededRandom(seed + a.id);
    const rb = seededRandom(seed + b.id);
    return ra - rb;
  });

  const sampledAgents = shuffled.slice(0, limit);

  // Sort by score descending for consistent rendering/legend order
  sampledAgents.sort((a, b) => (b.score || 0) - (a.score || 0));

  cachedData = {
    generatedAt: new Date(now).toISOString(),
    agents: sampledAgents,
    meta: {
      ...meta,
      countActive: activeAgents.length,
      thresholdMinutes: activeThresholdMinutes,
    },
  };
  lastFetchTime = now;

  return NextResponse.json(cachedData);
}
