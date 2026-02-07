import { NextResponse, NextRequest } from 'next/server';
import type { LiveResponse } from '@/lib/types';
import { openwork } from '@/lib/openwork';
import { createPublicClient, http, isAddress } from 'viem';
import { base } from 'viem/chains';
import { ERC20_ABI, OWT_TOKEN_ADDRESS, calculateAuraLevel } from '@/lib/tokens';

// Caching configuration
const CACHE_TTL = 30; // seconds
let cachedData: LiveResponse | null = null;
let lastFetchTime = 0;

// Onchain cache for token-holder highlighting
const OWT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const owtCache = new Map<string, { balance: bigint; cachedAt: number }>();

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

async function getOwtBalances(addresses: string[]): Promise<Map<string, bigint>> {
  const now = Date.now();
  const out = new Map<string, bigint>();

  const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase())));
  const fresh: string[] = [];

  for (const a of uniq) {
    const rec = owtCache.get(a);
    if (rec && (now - rec.cachedAt) < OWT_CACHE_TTL_MS) {
      out.set(a, rec.balance);
    } else {
      fresh.push(a);
    }
  }

  if (fresh.length) {
    // Multicall balanceOf for efficiency
    const contracts = fresh.map((addr) => ({
      address: OWT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf' as const,
      args: [addr as `0x${string}`] as const,
    }));

    try {
      const results = await publicClient.multicall({ contracts, allowFailure: true });
      results.forEach((r, i) => {
        const addr = fresh[i]!;
        const bal = (r.status === 'success' ? (r.result as bigint) : 0n);
        out.set(addr, bal);
        owtCache.set(addr, { balance: bal, cachedAt: now });
      });
    } catch {
      // If multicall fails, just mark unknowns as 0 for this response.
      for (const addr of fresh) {
        out.set(addr, 0n);
      }
    }
  }

  return out;
}

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

  const { agents, meta } = await openwork.getAgents(50, 60);

  // Onchain augmentation: mark agents that hold any OWT
  const wallets = agents
    .map((a) => a.walletAddress)
    .filter((a): a is string => typeof a === 'string' && isAddress(a));

  const balances = wallets.length ? await getOwtBalances(wallets) : new Map<string, bigint>();

  const agentsAug = agents.map((a) => {
    const w = a.walletAddress?.toLowerCase();
    const bal = w ? (balances.get(w) ?? 0n) : 0n;
    return {
      ...a,
      hasOwt: bal > 0n,
      owtBalance: bal.toString(),
      auraLevel: calculateAuraLevel(bal),
    };
  });

  cachedData = {
    generatedAt: new Date(now).toISOString(),
    agents: agentsAug,
    meta: {
      ...meta,
    },
  };
  lastFetchTime = now;

  return NextResponse.json(cachedData);
}
