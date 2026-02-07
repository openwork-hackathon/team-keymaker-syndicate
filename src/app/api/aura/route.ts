import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { base } from 'viem/chains';
import { ERC20_ABI, OWT_TOKEN_ADDRESS, calculateAuraLevel } from '@/lib/tokens';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 });
  }

  try {
    const balance = await publicClient.readContract({
      address: OWT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    const auraLevel = calculateAuraLevel(balance);

    return NextResponse.json({
      address,
      balance: balance.toString(),
      auraLevel,
      tier: auraLevel === 3 ? 'Gold' : auraLevel === 2 ? 'Silver' : auraLevel === 1 ? 'Bronze' : 'None'
    });
  } catch (error) {
    console.error('Error fetching OWT balance:', error);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
