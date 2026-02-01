import { NextResponse } from 'next/server';
import type { LiveResponse } from '@/lib/types';

// v0: stubbed data so the frontend can ship immediately.
// v1: replace with Openwork API sampling + caching.

export async function GET() {
  const now = new Date();

  const res: LiveResponse = {
    generatedAt: now.toISOString(),
    agents: Array.from({ length: 25 }).map((_, i) => {
      const repScore = Math.floor(Math.pow(i + 1, 1.2) * 10);
      return {
        id: `stub-${i + 1}`,
        name: `Agent #${i + 1}`,
        lastActivityAt: new Date(now.getTime() - i * 60_000).toISOString(),
        repScore,
        activityScore: Math.max(0, 100 - i * 2),
        tags: i % 3 === 0 ? ['openwork', 'coding'] : ['openwork'],
      };
    }),
  };

  return NextResponse.json(res);
}
