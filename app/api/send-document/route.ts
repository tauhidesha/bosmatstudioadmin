import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_API_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://35.232.177.23:4000').trim().replace(/\/$/, "");

/**
 * Resolves the correct WhatsApp recipient number.
 * 
 * The old /generate-invoice endpoint did a DB lookup to find the customer's
 * whatsappLid. We replicate that here so the PDF goes to the right person.
 */
async function resolveRecipientNumber(number: string): Promise<string> {
  if (!number) return number;
  
  const cleanNumber = number.replace(/[^0-9]/g, '');
  
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: cleanNumber },
          { whatsappLid: number },
          ...(cleanNumber ? [{ phone: cleanNumber.replace(/^0/, '62') }] : []),
        ]
      },
      select: { whatsappLid: true, phone: true }
    });
    
    if (customer?.whatsappLid) {
      console.log(`[send-document] Resolved LID: ${customer.whatsappLid} for ${number}`);
      return customer.whatsappLid;
    }
  } catch (err: any) {
    console.warn(`[send-document] Failed to resolve LID for ${number}:`, err.message);
  }
  
  // Fallback: ensure proper suffix
  if (number.includes('@')) return number;
  const digits = cleanNumber.startsWith('0') ? '62' + cleanNumber.slice(1) : cleanNumber;
  return `${digits}@c.us`;
}

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

    // Resolve the correct WhatsApp number (handle LID)
    const resolvedNumber = await resolveRecipientNumber(number);
    console.log(`[send-document] Sending to resolved: ${resolvedNumber} (original: ${number})`);

    // Proxy to Node.js backend to send via Baileys
    const upstream = await fetch(`${BOT_API_URL}/send-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        number: resolvedNumber,
        base64,
        mimetype: mimetype || 'application/pdf',
        filename: filename || 'document.pdf',
        caption,
      }),
    });

    const responseText = await upstream.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { error: 'Invalid JSON from backend', raw: responseText.substring(0, 200) };
    }

    if (upstream.ok && responseJson.success !== false) {
      return NextResponse.json({
        success: true,
        message: 'Dokumen terkirim',
        details: responseJson
      });
    } else {
      console.error(`[send-document] Backend error:`, responseJson);
      return NextResponse.json(
        { success: false, error: 'Gagal mengirim dokumen', details: responseJson },
        { status: upstream.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('[send-document] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
