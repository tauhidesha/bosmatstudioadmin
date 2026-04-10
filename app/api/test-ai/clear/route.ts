import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

const proxyHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  'x-internal-secret': INTERNAL_SECRET,
};

/**
 * DELETE /api/test-ai/clear
 * Proxy to Express DELETE /test-ai/clear — wipe playground history + LangGraph state.
 */
export async function DELETE(_req: NextRequest) {
  try {
    const upstream = await fetch(`${BOT_API_URL}/test-ai/clear`, {
      method: 'DELETE',
      headers: proxyHeaders,
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, error: 'Backend returned non-JSON response' };
    }

    return NextResponse.json(data, { status: upstream.ok ? 200 : 502 });
  } catch (error: any) {
    console.error('[Proxy test-ai/clear] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
