import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/firebase-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { paymentMethod = 'Transfer BCA', amountPaid } = body;

    const firestore = getDb();
    const bookingRef = firestore.collection('bookings').doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const bookingData = bookingDoc.data()!;
    const dp = bookingData.downPayment || 0;
    const remainingBalance = Math.max(0, (bookingData.subtotal || 0) - dp);
    const finalAmount = amountPaid || remainingBalance;

    // 1. Send receipt via Express Backend
    // Use environment variable if set, otherwise use the ngrok URL for GCP backend
    const backendUrl = process.env.BACKEND_API_URL || 'https://unblissful-unverdantly-stan.ngrok-free.dev';
    try {
      await fetch(`${backendUrl}/generate-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'bukti_bayar',
          customerName: bookingData.invoiceName || bookingData.customerName,
          customerPhone: bookingData.customerPhone,
          motorDetails: bookingData.vehicleInfo || '-',
          items: (bookingData.services || []).join(', ') || '-',
          totalAmount: bookingData.subtotal || 0,
          amountPaid: bookingData.subtotal || 0, // fully paid
          paymentMethod,
          notes: bookingData.notes || '',
          bookingDate: bookingData.bookingDate,
        }),
      });
      console.log(`[Payment] Receipt sent for booking ${id}`);

      const servicesString = (bookingData.services || []).join(', ').toLowerCase();
      const includesRepaint = servicesString.includes('repaint');
      const includesCoating = servicesString.includes('coating');

      if (includesRepaint) {
        await fetch(`${backendUrl}/generate-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'garansi_repaint',
            customerName: bookingData.invoiceName || bookingData.customerName,
            customerPhone: bookingData.customerPhone,
            motorDetails: bookingData.vehicleInfo || '-',
            items: (bookingData.services || []).join(', ') || '-',
            totalAmount: bookingData.subtotal || 0,
            amountPaid: bookingData.subtotal || 0,
            paymentMethod,
            notes: bookingData.notes || '',
            bookingDate: bookingData.bookingDate,
          }),
        });
        console.log(`[Payment] Warranty Repaint sent for booking ${id}`);
      }

      if (includesCoating) {
        await fetch(`${backendUrl}/generate-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'garansi_coating',
            customerName: bookingData.invoiceName || bookingData.customerName,
            customerPhone: bookingData.customerPhone,
            motorDetails: bookingData.vehicleInfo || '-',
            items: (bookingData.services || []).join(', ') || '-',
            totalAmount: bookingData.subtotal || 0,
            amountPaid: bookingData.subtotal || 0,
            paymentMethod,
            notes: bookingData.notes || '',
            bookingDate: bookingData.bookingDate,
          }),
        });
        console.log(`[Payment] Warranty Coating sent for booking ${id}`);

        // Set coating maintenance record (Default to 6 months later)
        const maintenanceDate = new Date();
        maintenanceDate.setMonth(maintenanceDate.getMonth() + 6);

        await firestore.collection('coatingMaintenance').doc(id).set({
          bookingId: id,
          customerName: bookingData.customerName,
          customerPhone: bookingData.customerPhone,
          vehicleInfo: bookingData.vehicleInfo || '-',
          maintenanceDate,
          status: 'pending', // pending, reminded_h7, reminded_h3, reminded_h1, scheduled, ignored
          createdAt: new Date()
        });
      }
    } catch (e) {
      console.warn(`[Payment] Failed to send document for booking ${id}:`, e);
    }

    // 2. Update Booking Status
    await bookingRef.update({
      status: 'paid',
      paymentMethod,
      amountPaid: finalAmount,
      paidAt: new Date(),
    });

    // Normalize phone for CRM & Finance ID
    let customerId = bookingData.customerPhone?.replace(/\D/g, '') || '';
    if (customerId && !customerId.endsWith('@c.us') && !customerId.endsWith('@lid')) {
      customerId = customerId.startsWith('0') ? `62${customerId.slice(1)}@c.us` : `${customerId}@c.us`;
    }

    // 3. Auto-create Finance Transaction
    if (finalAmount > 0) {
      const now = new Date();
      await firestore.collection('transactions').add({
        type: 'income',
        amount: finalAmount,
        category: 'Service',
        description: `Pelunasan Service: ${(bookingData.services || []).join(', ')}${dp > 0 ? ` (DP Rp ${dp.toLocaleString()} sudah dibayar)` : ''}`,
        paymentMethod,
        date: now,
        createdAt: now,
        customerName: bookingData.customerName,
        customerNumber: bookingData.customerPhone,
        customerId: customerId,
        sourceBookingId: id,
      });

      // 4. Update totalSpending in CRM
      if (customerId) {
        const crmRef = firestore.collection('directMessages').doc(customerId);
        const crmDoc = await crmRef.get();
        if (crmDoc.exists) {
          const currentSpending = Number(crmDoc.data()?.totalSpending) || 0;
          await crmRef.update({
            totalSpending: currentSpending + finalAmount
          });
          console.log(`[Payment] Updated CRM totalSpending for ${customerId}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pembayaran lunas untuk ${bookingData.customerName} berhasil disimpan.`
    });
  } catch (error: any) {
    console.error('[Payment] Error processing payment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
