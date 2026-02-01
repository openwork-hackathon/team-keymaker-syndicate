import { NextResponse } from 'next/server';
import type { LiveResponse } from '@/lib/types';

// Simple in-memory cache for v1
let cache: { data: LiveResponse; timestamp: number } | null = null;
const CACHE_TTL = 30 * 1000; // 30 seconds

// Simple rate limiting
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;
const requestLog: Map<string, number[]> = new Map();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  let timestamps = requestLog.get(ip) || [];
  timestamps = timestamps.filter(ts => ts > windowStart);
  
  if (timestamps.length >= MAX_REQUESTS) {
    return true;
  }
  
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return false;
}

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  
  if (isRateLimited(ip)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const now = Date.now();

  if (cache && (now - cache.timestamp < CACHE_TTL)) {
    return NextResponse.json(cache.data);
  }

  // v1: Simulated fetch from Openwork API (replacing stub)
  // In a real scenario, this would be: await fetch('https://api.openwork.bot/v1/agents', ...)
  const agents = Array.from({ length: 25 }).map((_, i) => {
    const repScore = Math.floor(Math.pow(i + 1, 1.2) * 10);
    return {
      id: `agent-${i + 1}`,
      name: `Agent ${i + 1}`,
      lastActivityAt: new Date(now - i * 60_000).toISOString(),
      repScore,
      activityScore: Math.max(0, 100 - i * 2),
      tags: i % 3 === 0 ? ['openwork', 'active'] : ['openwork'],
    };
  });

  const res: LiveResponse = {
    generatedAt: new Date(now).toISOString(),
    agents,
  };

  cache = { data: res, timestamp: now };

  return NextResponse.json(res);
}
