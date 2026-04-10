import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

const proxyHeaders = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  'x-internal-secret': INTERNAL_SECRET,
};

/** GET /api/follow-up-queue/execute-status — poll background execute progress */
export async function GET(_req: NextRequest) {
  try {
    const upstream = await fetch(`${BOT_API_URL}/follow-up-queue/execute-status`, {
      headers: proxyHeaders,
      cache: 'no-store',
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
