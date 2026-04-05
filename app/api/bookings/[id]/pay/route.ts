import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: bookingId } = params;
    const body = await req.json();
    const authHeader = req.headers.get('authorization');
    const { paymentMethod = 'Transfer BCA', amountPaid, sendInvoice = true } = body;

    // Check if booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        customer: true,
        transaction: true
      }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const dp = booking.downPayment || 0;
    const subtotal = booking.subtotal || 0;
    const totalAmount = booking.totalAmount || subtotal;
    const remainingBalance = Math.max(0, totalAmount - dp);
    const finalAmount = amountPaid !== undefined ? amountPaid : remainingBalance;

    // 1. Send receipt & warranty via Express Backend (if sendInvoice is true)
    if (sendInvoice) {
      const backendUrl = process.env.BACKEND_API_URL || 'https://unblissful-unverdantly-stan.ngrok-free.dev';
      try {
      await fetch(`${backendUrl}/generate-invoice`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authHeader ? { 'Authorization': authHeader } : {}),
        },
        body: JSON.stringify({
          documentType: 'bukti_bayar',
          customerName: booking.customerName || booking.customer?.name,
          customerPhone: booking.customerPhone,
          motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
          items: booking.serviceType,
          totalAmount: booking.totalAmount || subtotal,
          amountPaid: finalAmount,
          paymentMethod,
          notes: booking.notes || '',
          bookingDate: booking.bookingDate.toISOString().split('T')[0],
        }),
      });
      console.log(`[Payment] Receipt sent for booking ${bookingId}`);

      const servicesString = booking.serviceType?.toLowerCase() || '';
      const categoryString = booking.category?.toLowerCase() || '';

      // Check repaint: keyword in serviceType OR category
      const includesRepaint = servicesString.includes('repaint') 
                           || categoryString === 'repaint';

      // Check coating: keyword in serviceType, category, or known service names
      const includesCoating = servicesString.includes('coating')
                           || servicesString.includes('glossy')
                           || servicesString.includes('complete service')
                           || servicesString.includes('nano ceramic')
                           || categoryString === 'coating';

      if (includesRepaint) {
        await fetch(`${backendUrl}/generate-invoice`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {}),
          },
          body: JSON.stringify({
            documentType: 'garansi_repaint',
            customerName: booking.customerName || booking.customer?.name,
            customerPhone: booking.customerPhone,
            motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
            items: booking.serviceType,
            totalAmount: booking.totalAmount || subtotal,
            amountPaid: finalAmount,
            paymentMethod,
            notes: booking.notes || '',
            bookingDate: booking.bookingDate.toISOString().split('T')[0],
          }),
        });
        console.log(`[Payment] Warranty Repaint sent for booking ${bookingId}`);
      }

      if (includesCoating) {
        await fetch(`${backendUrl}/generate-invoice`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {}),
          },
          body: JSON.stringify({
            documentType: 'garansi_coating',
            customerName: booking.customerName || booking.customer?.name,
            customerPhone: booking.customerPhone,
            motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
            items: booking.serviceType,
            totalAmount: booking.totalAmount || subtotal,
            amountPaid: finalAmount,
            paymentMethod,
            notes: booking.notes || '',
            bookingDate: booking.bookingDate.toISOString().split('T')[0],
          }),
        });
        console.log(`[Payment] Warranty Coating sent for booking ${bookingId}`);

        // Create coating maintenance record (6 months later)
        const maintenanceDate = new Date();
        maintenanceDate.setMonth(maintenanceDate.getMonth() + 6);

        await prisma.coatingMaintenance.create({
          data: {
            bookingId: bookingId,
            customerName: booking.customerName || booking.customer?.name || 'Unknown',
            customerPhone: booking.customerPhone || '',
            vehicleInfo: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
            maintenanceDate,
            status: 'pending',
          }
        });
      }
      } catch (e) {
        console.warn(`[Payment] Failed to send document for booking ${bookingId}:`, e);
      }
    } // end if (sendInvoice)

    // 2. Update Booking Status to PAID
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'SUCCESS',
        paymentMethod,
      }
    });

    // 3. Create or Update Transaction for the payment
    const existingTransaction = await prisma.transaction.findUnique({
      where: { bookingId }
    });

    if (existingTransaction) {
      await prisma.transaction.update({
        where: { id: existingTransaction.id },
        data: {
          amount: finalAmount,
          status: 'SUCCESS',
          paymentMethod: paymentMethod.toLowerCase(),
          description: `Pelunasan Service: ${booking.serviceType}${dp > 0 ? ` (DP Rp ${dp.toLocaleString()} sudah dibayar)` : ''}`,
        }
      });
    } else {
      await prisma.transaction.create({
        data: {
          customerId: booking.customerId,
          bookingId,
          amount: finalAmount,
          type: 'income',
          status: 'SUCCESS',
          description: `Pelunasan Service: ${booking.serviceType}${dp > 0 ? ` (DP Rp ${dp.toLocaleString()} sudah dibayar)` : ''}`,
          paymentMethod: paymentMethod.toLowerCase(),
        }
      });
    }

    // 4. Update customer totalSpending
    if (booking.customerId && finalAmount > 0) {
      await prisma.customer.update({
        where: { id: booking.customerId },
        data: { 
          totalSpending: { increment: finalAmount },
          lastService: booking.bookingDate
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Pembayaran lunas untuk ${booking.customerName || booking.customer?.name} berhasil disimpan.`
    });
  } catch (error: any) {
    console.error('[Payment] Error processing payment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}