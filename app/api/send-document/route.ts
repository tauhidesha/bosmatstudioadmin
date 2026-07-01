import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://35.232.177.23:4000').trim().replace(/\/$/, "");
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { number, base64, mimetype, filename, caption } = body;

    if (!number || !base64) {
      return NextResponse.json(
        { success: false, error: 'number dan base64 wajib diisi' },
        { status: 400 }
      );
    }

    const headersList = headers();
    let authHeader = headersList.get('authorization');
    if (!authHeader) {
      const sessionCookie = headersList.get('cookie')?.split(';').find(c => c.trim().startsWith('__session='))?.split('=')[1];
      if (sessionCookie) {
        authHeader = `Bearer ${sessionCookie}`;
      }
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Sesi anda telah berakhir. Silakan login ulang.' }, { status: 401 });
    }

    // Proxy to Node.js backend to send via Baileys
    const upstream = await fetch(`${BOT_API_URL}/send-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ number, base64, mimetype: mimetype || 'application/pdf', filename: filename || 'document.pdf', caption }),
    });

    const responseText = await upstream.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { error: 'Invalid JSON from backend' };
    }

    if (upstream.ok && responseJson.success !== false) {
      return NextResponse.json({
        success: true,
        message: 'Dokumen terkirim',
        details: responseJson
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Gagal mengirim dokumen', details: responseJson },
        { status: upstream.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending document:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
