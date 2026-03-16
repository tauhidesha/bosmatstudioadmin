import { NextRequest, NextResponse } from 'next/server';
import { getConversationHistory } from '@/lib/server/firebase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const number = params.number;
    
    if (!number) {
      return NextResponse.json(
        { success: false, error: 'Nomor WhatsApp tidak valid' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    let limit = 50;

    if (limitParam && !isNaN(parseInt(limitParam, 10))) {
      limit = parseInt(limitParam, 10);
    }

    const history = await getConversationHistory(number, limit);

    return NextResponse.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    console.error(`Error fetching history for ${params.number}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
