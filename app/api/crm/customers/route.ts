import { NextResponse } from 'next/server';
import { listCustomers } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const customers = await listCustomers(50);
    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    console.error('[API CRM] Fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
