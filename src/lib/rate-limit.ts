import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

interface RateLimitRecord {
  count: number;
  expiresAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const direct = (req as any).ip as string | undefined;
  return direct || 'anonymous';
}

export function checkRateLimit(ip: string): { limited: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.expiresAt) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }

  if (record.count >= MAX_REQUESTS) {
    return { limited: true, retryAfter: Math.ceil((record.expiresAt - now) / 1000) };
  }

  record.count += 1;
  return { limited: false };
}

export function rateLimitResponse(retryAfter: number) {
  return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
    },
  });
}
