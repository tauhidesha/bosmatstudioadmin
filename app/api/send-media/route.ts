import { NextRequest, NextResponse } from 'next/server';
import { sendMedia } from '@/lib/server/fonnte-client';
import { saveMessageToFirestore } from '@/lib/server/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { number, mediaUrl, caption, filename } = body;

    if (!number || !mediaUrl) {
      return NextResponse.json(
        { success: false, error: 'number dan mediaUrl wajib diisi' },
        { status: 400 }
      );
    }

    // Send via Fonnte API
    const response = await sendMedia(number, mediaUrl, filename, caption);

    if (response.status) {
      const textToSave = caption ? `[Media: ${mediaUrl}] ${caption}` : `[Media: ${mediaUrl}]`;
      await saveMessageToFirestore(number, textToSave, 'admin');

      return NextResponse.json({
        success: true,
        message: 'Media terkirim',
        details: response
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Gagal mengirim media via Fonnte', details: response },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending media:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
