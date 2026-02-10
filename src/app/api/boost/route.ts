import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { saveBoost } from '@/lib/storage';
import { isAddress } from 'viem';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { limited, retryAfter } = checkRateLimit(ip);

  if (limited && retryAfter) {
    return rateLimitResponse(retryAfter);
  }

  try {
    const body = await req.json();
    const { agentAddress, amount } = body;

    if (!agentAddress || !isAddress(agentAddress)) {
      return NextResponse.json({ error: 'Invalid agent address' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    saveBoost({
      timestamp: Date.now(),
      agentAddress,
      amount,
      source: ip,
      type: 'boost',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
