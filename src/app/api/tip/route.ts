import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { agentId, amountOWT } = await req.json();

    if (!agentId || !amountOWT) {
      return NextResponse.json({ error: 'Missing agentId or amountOWT' }, { status: 400 });
    }

    // Mock response for now as requested
    // returns intent + link to Mint Club or future tx flow
    return NextResponse.json({
      success: true,
      agentId,
      amountOWT,
      intent: 'TIP_AGENT',
      link: `https://mint.club/token/base/OWT?tip=${agentId}&amount=${amountOWT}`,
      message: `Tip intent created for agent ${agentId}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
