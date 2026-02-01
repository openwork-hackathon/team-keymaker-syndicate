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

  const { agents, meta } = await openwork.getAgents(50);

  cachedData = {
    generatedAt: new Date(now).toISOString(),
    agents,
    meta,
  };
  lastFetchTime = now;

  return NextResponse.json(cachedData);
}
