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

  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  // Fetch real agents from Openwork
  const { agents, meta } = await openwork.getAgents(limit);

  // Filter for 'active now' based on threshold
  const activeThresholdMinutes = parseInt(searchParams.get('threshold') || '60', 10);
  const activeThresholdMs = activeThresholdMinutes * 60 * 1000;
  const activeAgents = agents.filter(a => {
    const lastSeen = new Date(a.lastActivityAt).getTime();
    return (now - lastSeen) < activeThresholdMs;
  });

  // Deterministic sampling (seeded by hour)
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

  // Shuffle with seed to provide stable but changing sampling
  const shuffled = [...activeAgents].sort((a, b) => {
    const ra = seededRandom(seed + a.id);
    const rb = seededRandom(seed + b.id);
    return ra - rb;
  });

  const sampledAgents = shuffled.slice(0, limit);

  // Sort by reputation score for consistent rendering
  sampledAgents.sort((a, b) => (b.repScore || 0) - (a.repScore || 0));

  cachedData = {
    generatedAt: new Date(now).toISOString(),
    agents: sampledAgents,
    meta,
  };
  lastFetchTime = now;

  return NextResponse.json(cachedData);
}
