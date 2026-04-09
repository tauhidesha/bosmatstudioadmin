import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

/**
 * POST /api/follow-up-queue/execute
 * Proxy to Express POST /follow-up-queue/execute — sends approved queue items.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${BOT_API_URL}/follow-up-queue/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    console.error('[API Proxy] POST /follow-up-queue/execute error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
