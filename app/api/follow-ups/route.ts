import { NextResponse } from 'next/server';
import { listFollowUpQueue } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const items = await listFollowUpQueue();
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('[API Follow-ups] Fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
