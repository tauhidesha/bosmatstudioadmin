import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

const headers = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  'x-internal-secret': INTERNAL_SECRET,
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('[Proxy saved] Non-JSON upstream response:', text.substring(0, 200));
    return { success: false, error: 'Backend returned non-JSON response' };
  }
}

/** GET /api/follow-up-queue/saved — load saved queue from DB */
export async function GET(_req: NextRequest) {
  try {
    const upstream = await fetch(`${BOT_API_URL}/follow-up-queue/saved`, { headers, cache: 'no-store' });
    const data = await safeJson(upstream);
    return NextResponse.json(data, { status: upstream.ok ? 200 : 502 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** POST /api/follow-up-queue/save — persist queue to DB */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const upstream = await fetch(`${BOT_API_URL}/follow-up-queue/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await safeJson(upstream);
    return NextResponse.json(data, { status: upstream.ok ? 200 : 502 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** DELETE /api/follow-up-queue/saved — clear saved queue */
export async function DELETE(_req: NextRequest) {
  try {
    const upstream = await fetch(`${BOT_API_URL}/follow-up-queue/saved`, { method: 'DELETE', headers });
    const data = await safeJson(upstream);
    return NextResponse.json(data, { status: upstream.ok ? 200 : 502 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
