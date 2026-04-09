import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

/**
 * GET /api/follow-up-queue
 * Proxy to Express GET /follow-up-queue — returns dry-run preview of all scheduled messages.
 */
export async function GET(_req: NextRequest) {
  try {
    const upstream = await fetch(`${BOT_API_URL}/follow-up-queue`, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'x-internal-secret': INTERNAL_SECRET,
      },
      cache: 'no-store',
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    console.error('[API Proxy] GET /follow-up-queue error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
