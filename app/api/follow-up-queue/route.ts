import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('[Proxy follow-up-queue] Non-JSON upstream response:', text.substring(0, 200));
    return { success: false, error: 'Backend returned non-JSON response' };
  }
}

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

    const data = await safeJson(upstream);
    return NextResponse.json(data, { status: upstream.ok ? 200 : 502 });
  } catch (err: any) {
    console.error('[API Proxy] GET /follow-up-queue error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
