import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://35.232.177.23:4000').trim().replace(/\/$/, "");
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { number, message } = body;

    if (!number || !message) {
      return NextResponse.json(
        { success: false, error: 'number dan message wajib diisi' },
        { status: 400 }
      );
    }

    // Proxy to Node.js backend to send via Baileys
    const upstream = await fetch(`${BOT_API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ number, message }),
    });

    const responseText = await upstream.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { error: 'Invalid JSON from backend' };
    }

    if (upstream.ok && responseJson.success !== false) {
      // The Node.js backend handles saving the message to Prisma via Baileys event listeners
      return NextResponse.json({
        success: true,
        message: 'Pesan terkirim',
        details: responseJson
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Gagal mengirim pesan via Baileys', details: responseJson },
        { status: upstream.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}