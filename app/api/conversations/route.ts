import { NextRequest, NextResponse } from 'next/server';
import { listConversations } from '@/lib/server/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    let limit = 100;

    if (limitParam && !isNaN(parseInt(limitParam, 10))) {
      limit = parseInt(limitParam, 10);
    }

    const conversations = await listConversations(limit);
    return NextResponse.json({
      success: true,
      data: conversations
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
