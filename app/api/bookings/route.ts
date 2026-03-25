import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    let limit = 50;

    if (limitParam && !isNaN(parseInt(limitParam, 10))) {
      limit = parseInt(limitParam, 10);
    }

    const firestore = getDb();
    const snapshot = await firestore
      .collection('bookings')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
      
    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      data: bookings
    });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerPhone, serviceName, bookingDate, bookingTime, vehicleInfo, notes, subtotal, homeService, invoiceName, dpAmount } = body;

    if (!customerName || !customerPhone || !serviceName || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customerName, customerPhone, serviceName, bookingDate, bookingTime' },
        { status: 400 }
      );
    }

    const firestore = getDb();
    const now = new Date();
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    const downPayment = dpAmount || 0;

    const bookingData = {
      customerName,
      customerPhone: customerPhone.replace(/\D/g, ''),
      invoiceName: invoiceName || '',
      services: serviceName.split(',').map((s: string) => s.trim()).filter(Boolean),
      bookingDate,
      bookingTime,
      bookingDateTime,
      vehicleInfo: vehicleInfo || '',
      notes: notes || '',
      subtotal: subtotal || 0,
      downPayment,
      homeService: homeService || false,
      status: 'pending',
      source: 'manual_admin',
      createdAt: now,
      timestamp: now,
    };

    const docRef = await firestore.collection('bookings').add(bookingData);

    // Auto-create Finance income for Down Payment
    if (downPayment > 0) {
      let customerId = bookingData.customerPhone;
      if (customerId && !customerId.endsWith('@c.us') && !customerId.endsWith('@lid')) {
        customerId = customerId.startsWith('0') ? `62${customerId.slice(1)}@c.us` : `${customerId}@c.us`;
      }

      await firestore.collection('transactions').add({
        type: 'income',
        amount: downPayment,
        category: 'Down Payment',
        description: `DP Booking: ${serviceName}`,
        paymentMethod: 'Transfer BCA',
        date: now,
        createdAt: now,
        customerName,
        customerNumber: bookingData.customerPhone,
        customerId,
        sourceBookingId: docRef.id,
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: docRef.id, ...bookingData },
      message: `Booking untuk ${customerName} berhasil dibuat`,
    });
  } catch (error: any) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal membuat booking', details: error.message },
      { status: 500 }
    );
  }
}
