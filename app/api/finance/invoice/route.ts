import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headersList = headers();
    let authHeader = headersList.get('authorization');
    
    // Fallback to __session cookie if Authorization header is missing
    if (!authHeader) {
      const sessionCookie = headersList.get('cookie')?.split(';').find(c => c.trim().startsWith('__session='))?.split('=')[1];
      if (sessionCookie) {
        authHeader = `Bearer ${sessionCookie}`;
      }
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Sesi anda telah berakhir. Silakan login ulang.' }, { status: 401 });
    }

    const backendUrl = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://35.232.177.23:4000').trim().replace(/\/$/, "");

    const response = await fetch(`${backendUrl}/generate-invoice`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorResp = await response.json().catch(() => ({}));
      console.error(`[Finance Invoice Proxy] Backend error ${response.status}:`, errorResp);
      return NextResponse.json(
        { success: false, error: 'Gagal membuat dokumen di backend', details: errorResp },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      message: result.message || 'Dokumen berhasil dibuat dan dikirim'
    });

  } catch (error: any) {
    console.error('[Finance Invoice Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
