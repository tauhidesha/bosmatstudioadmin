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

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('[Proxy test-ai] Non-JSON upstream:', text.substring(0, 200));
    return { success: false, error: 'Backend returned non-JSON response' };
  }
}

/**
 * POST /api/test-ai
 * Proxy to Express POST /test-ai — full LangGraph pipeline playground.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, mode, media } = body;

    if (!message && (!media || media.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Pesan atau media wajib diisi' },
        { status: 400 }
      );
    }

    const upstream = await fetch(`${BOT_API_URL}/test-ai`, {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify({ message, mode, media }),
    });

    const result = await safeJson(upstream);

    return NextResponse.json({
      success: upstream.ok,
      response: result.ai_response,
      intent: result.intent || null,
      mode: result.mode || mode || 'customer',
      memory_enabled: result.memory_enabled ?? true,
    }, { status: upstream.ok ? 200 : 502 });

  } catch (error: any) {
    console.error('[Test-AI Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
