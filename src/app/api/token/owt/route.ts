import { NextResponse, NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { ERC20_ABI, OWT_TOKEN_ADDRESS } from '@/lib/tokens';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
  updatedAt: string;
}

let cachedTokenInfo: TokenInfo | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 3600 * 1000; // 1 hour

const TOKEN_ABI = [
  ...ERC20_ABI,
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

async function fetchTokenInfo(): Promise<TokenInfo> {
  const [symbol, decimals, totalSupply] = await Promise.all([
    publicClient.readContract({
      address: OWT_TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: OWT_TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: OWT_TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: 'totalSupply',
    }).catch(() => null),
  ]);

  return {
    address: OWT_TOKEN_ADDRESS,
    symbol: symbol as string,
    decimals: decimals as number,
    totalSupply: totalSupply ? totalSupply.toString() : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const now = Date.now();

  if (cachedTokenInfo && (now - lastFetchTime) < CACHE_TTL_MS) {
    return NextResponse.json(cachedTokenInfo);
  }

  try {
    const info = await fetchTokenInfo();
    cachedTokenInfo = info;
    lastFetchTime = now;
    return NextResponse.json(info);
  } catch (error) {
    console.error('Error fetching token info:', error);
    return NextResponse.json({ error: 'Failed to fetch token info' }, { status: 500 });
  }
}
