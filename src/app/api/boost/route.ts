import { NextResponse, NextRequest } from 'next/server';

interface BoostRecord {
  agentId: string;
  amountOWT: string;
  duration: string;
  timestamp: string;
}

// In-memory store for boosts
const boostStore: BoostRecord[] = [];

export async function POST(req: NextRequest) {
  try {
    const { agentId, amountOWT, duration } = await req.json();

    if (!agentId || !amountOWT || !duration) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const record: BoostRecord = {
      agentId,
      amountOWT,
      duration,
      timestamp: new Date().toISOString(),
    };

    boostStore.push(record);

    // Keep only the last 1000 boosts to avoid memory leak
    if (boostStore.length > 1000) {
      boostStore.shift();
    }

    return NextResponse.json({
      success: true,
      record,
      message: `Boost record created for agent ${agentId}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  // Optional: Allow getting recent boosts
  return NextResponse.json(boostStore);
}
