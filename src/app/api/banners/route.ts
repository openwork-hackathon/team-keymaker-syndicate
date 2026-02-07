import { NextResponse, NextRequest } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { base } from 'viem/chains';
import { ERC20_ABI, OWT_TOKEN_ADDRESS } from '@/lib/tokens';

// NOTE: This is a lightweight hackathon implementation.
// On Vercel/serverless, in-memory state is best-effort (may reset between invocations).

type BannerRecord = {
  id: string;
  wx: number;
  wy: number;
  ownerAddress: string; // 0x…
  ownerShort: string;   // 0x12…abcd
  createdAt: number;
  expiresAt: number;
};

const WORLD_W = 2400;
const WORLD_H = 1600;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BANNERS = 200;

// In-memory store (best-effort)
const store: {
  banners: BannerRecord[];
  // simple rate limit: ip -> {count, expiresAt}
  rate: Map<string, { count: number; expiresAt: number }>;
} = (globalThis as any).__owt_banners_store ?? {
  banners: [],
  rate: new Map(),
};
(globalThis as any).__owt_banners_store = store;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;
const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const direct = (req as any).ip as string | undefined;
  return direct || 'anonymous';
}

function sweep(now: number) {
  store.banners = store.banners.filter((b) => b.expiresAt > now);
  for (const [ip, rec] of store.rate) {
    if (now > rec.expiresAt) store.rate.delete(ip);
  }
  // hard cap
  if (store.banners.length > MAX_BANNERS) {
    store.banners = store.banners.slice(0, MAX_BANNERS);
  }
}

function isRateLimited(ip: string, now: number) {
  const rec = store.rate.get(ip);
  if (!rec || now > rec.expiresAt) {
    store.rate.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (rec.count >= MAX_REQUESTS) return true;
  rec.count += 1;
  return false;
}

async function isOwtHolder(addr: string): Promise<boolean> {
  try {
    const bal = await publicClient.readContract({
      abi: ERC20_ABI,
      address: OWT_TOKEN_ADDRESS,
      functionName: 'balanceOf',
      args: [addr as `0x${string}`],
    });
    return (bal as bigint) > 0n;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const now = Date.now();
  sweep(now);

  const ip = getClientIp(req);
  if (isRateLimited(ip, now)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  return NextResponse.json({
    banners: store.banners.map(({ id, wx, wy, ownerShort }) => ({ id, wx, wy, owner: ownerShort })),
    generatedAt: new Date(now).toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const now = Date.now();
  sweep(now);

  const ip = getClientIp(req);
  if (isRateLimited(ip, now)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const wx = Number(body?.wx);
  const wy = Number(body?.wy);
  const ownerAddress = String(body?.ownerAddress ?? '');

  if (!Number.isFinite(wx) || !Number.isFinite(wy)) {
    return NextResponse.json({ error: 'Invalid coords' }, { status: 400 });
  }
  if (!isAddress(ownerAddress)) {
    return NextResponse.json({ error: 'Invalid ownerAddress' }, { status: 400 });
  }

  // Verify holder status onchain (prevents spoofing / spam)
  const ok = await isOwtHolder(ownerAddress);
  if (!ok) {
    return NextResponse.json({ error: 'Requires holding OWT' }, { status: 403 });
  }

  const cx = clamp(wx, 40, WORLD_W - 40);
  const cy = clamp(wy, 40, WORLD_H - 40);
  const ownerShort = ownerAddress.slice(0, 6) + '…' + ownerAddress.slice(-4);

  const rec: BannerRecord = {
    id: String(now) + '-' + Math.random().toString(16).slice(2),
    wx: cx,
    wy: cy,
    ownerAddress,
    ownerShort,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };

  store.banners.unshift(rec);
  if (store.banners.length > MAX_BANNERS) store.banners.length = MAX_BANNERS;

  return NextResponse.json({
    banner: { id: rec.id, wx: rec.wx, wy: rec.wy, owner: rec.ownerShort },
  });
}
