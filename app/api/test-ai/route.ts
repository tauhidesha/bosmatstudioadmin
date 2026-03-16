import { NextRequest, NextResponse } from 'next/server';

/**
 * Test AI endpoint for the admin playground
 * Forwards requests to the Google ADK Python service
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history, mode, media, model_override } = body;

    if (!message && (!media || media.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Pesan atau media wajib diisi' },
        { status: 400 }
      );
    }

    const adkUrl = process.env.ADK_SERVICE_URL || 'http://localhost:8000';
    
    const payload = {
      message,
      history: history || [],
      mode: mode || 'customer',
      mediaItems: media || [],
      model_override: model_override || null
    };

    console.log(`[Test-AI] Forwarding playground request to ADK`);

    const res = await fetch(`${adkUrl}/test-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Test-AI] ADK Service Error:', res.status, errorText);
      return NextResponse.json(
        { success: false, error: `Gagal memanggil AI service: ${res.statusText}`, details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      response: data.response || data.text || data.message,
      data
    });

  } catch (error: any) {
    console.error('Error in test-ai:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
