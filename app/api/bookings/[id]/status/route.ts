import { NextRequest, NextResponse } from 'next/server';
import { getDb, FieldValue } from '@/lib/server/firebase-admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id;
    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'Booking ID tidak valid' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status, remarks } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status wajib diisi' },
        { status: 400 }
      );
    }

    const firestore = getDb();
    const bookingRef = firestore.collection('bookings').doc(bookingId);
    
    // Check if exists
    const doc = await bookingRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Booking tidak ditemukan' },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {
      status,
      updatedAt: FieldValue.serverTimestamp()
    };
    
    if (remarks !== undefined) {
      updateData.adminRemarks = remarks;
    }

    await bookingRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Status booking berhasil diupdate',
      bookingId,
      status
    });
  } catch (error: any) {
    console.error(`Error updating booking status for ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
