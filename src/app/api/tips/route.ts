import { NextResponse } from 'next/server';
import type { TipTransaction } from '@/lib/types';

// Mock data for the hackathon
const MOCK_TIPS: TipTransaction[] = [
  {
    id: '1',
    from: '0x6c4b979432716B2655AE569469eAae44300bAB86', // Team Wallet
    to: '0x1234567890123456789012345678901234567890',
    amount: '100',
    token: 'OWT',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    txHash: '0xabcdef1234567890'
  },
  {
    id: '2',
    from: '0x1234567890123456789012345678901234567890',
    to: '0x0987654321098765432109876543210987654321',
    amount: '50',
    token: 'OWT',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
  }
];

export async function GET() {
  // In a real app, we would fetch from a database or indexer
  return NextResponse.json({
    tips: MOCK_TIPS,
    generatedAt: new Date().toISOString()
  });
}
