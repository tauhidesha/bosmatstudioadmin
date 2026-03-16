import { NextRequest, NextResponse } from 'next/server';
import { sendText } from '@/lib/server/fonnte-client';
import { saveMessageToFirestore } from '@/lib/server/firebase-admin';

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

    // Send via Fonnte API
    const response = await sendText(number, message);

    if (response.status) {
      // Save outbound message to Firestore
      await saveMessageToFirestore(number, message, 'admin');

      return NextResponse.json({
        success: true,
        message: 'Pesan terkirim',
        details: response
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Gagal mengirim pesan via Fonnte', details: response },
        { status: 500 }
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
