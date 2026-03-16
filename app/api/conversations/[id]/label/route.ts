import { NextRequest, NextResponse } from 'next/server';
import { getDb, FieldValue } from '@/lib/server/firebase-admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'Conversation ID tidak valid' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { label, reason } = body;

    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label wajib diisi' },
        { status: 400 }
      );
    }

    const firestore = getDb();
    const docId = conversationId.replace(/@c\.us$|@lid$/, '');
    const docRef = firestore.collection('directMessages').doc(docId);
    
    // Check if exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Conversation tidak ditemukan' },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {
      customerLabel: label,
      updatedAt: FieldValue.serverTimestamp()
    };
    
    if (reason !== undefined) {
      updateData.labelReason = reason;
    }

    await docRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Label percakapan berhasil diupdate',
      conversationId,
      label
    });
  } catch (error: any) {
    console.error(`Error updating conversation label for ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
