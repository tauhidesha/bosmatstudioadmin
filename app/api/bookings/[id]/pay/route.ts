import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { sendCapiEvent } from '@/lib/meta-capi';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: bookingId } = params;
    const body = await req.json();
    const headersList = headers();
    let authHeader = headersList.get('authorization');
    
    // Fallback to __session cookie if Authorization header is missing
    if (!authHeader) {
      const sessionCookie = headersList.get('cookie')?.split(';').find(c => c.trim().startsWith('__session='))?.split('=')[1];
      if (sessionCookie) {
        authHeader = `Bearer ${sessionCookie}`;
        console.log('[Payment] Using session cookie as fallback auth');
      }
    }

    if (!authHeader) {
      console.error('[Payment] No Auth Header or Cookie in Next.js internal API');
      return NextResponse.json({ error: 'Sesi anda telah berakhir. Silakan login ulang.' }, { status: 401 });
    }

    const { paymentMethod = 'Transfer BCA', amountPaid, sendInvoice = true, sendRepaintWarranty = false, sendCoatingWarranty = false, status } = body;

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
    const discountAmount = subtotal - totalAmount;

    // 1. Send receipt & warranty via Express Backend
    if (sendInvoice) {
      const backendUrl = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://35.232.177.23:4000').trim().replace(/\/$/, "");
      console.log(`[Payment] Auth Header Present: ${!!authHeader}`);

      const generateDoc = async (documentType: string) => {
        try {
          const response = await fetch(`${backendUrl}/generate-invoice`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
              ...(authHeader ? { 'Authorization': authHeader } : {}),
            },
            body: JSON.stringify({
              documentType,
              customerName: booking.customerName || booking.customer?.name || '-',
              customerPhone: booking.customerPhone || booking.customer?.phone || '-',
              realPhone: (booking as any).realPhone || booking.customer?.phoneReal || '',
              motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : (booking as any).vehicleInfo || '-',
              items: (booking as any).services ? (Array.isArray((booking as any).services) ? (booking as any).services.join('\n') : (booking as any).services) : (booking as any).serviceType || '-',
              totalAmount: totalAmount,
              amountPaid: finalAmount,
              paymentMethod,
              notes: booking.notes || '',
              serviceType: (booking as any).category || (booking as any).serviceType || '-',
              subtotal,
              discount: discountAmount,
              downPayment: dp,
            }),
          });

          if (!response.ok) {
            const errorResp = await response.json().catch(() => ({}));
            console.error(`[Payment] Backend error ${response.status} generating ${documentType}:`, errorResp);
          } else {
            console.log(`[Payment] Successfully generated ${documentType} for booking ${bookingId}`);
            
            if (documentType === 'garansi_coating') {
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
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between docs
        } catch (e: any) {
          console.error(`[Payment] Critical failure in backend communication for ${documentType}: ${e.message}`);
        }
      };

      await generateDoc('bukti_bayar');
      if (sendRepaintWarranty) await generateDoc('garansi_repaint');
      if (sendCoatingWarranty) await generateDoc('garansi_coating');
    } // end if (sendInvoice)

    // 2. Update Booking Status
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: status || 'COMPLETED',
        paymentMethod,
        paymentStatus: 'PAID',
        amountPaid: totalAmount,
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

    // 4. Update customer totalSpending + lastService (payment = work done)
    if (booking.customerId && finalAmount > 0) {
      await prisma.customer.update({
        where: { id: booking.customerId },
        data: { 
          totalSpending: { increment: finalAmount },
          lastService: booking.bookingDate,
        }
      });
    }

    // 5. Reset CustomerContext review flags so scheduler sends review 3 days later
    const customerPhone = booking.customer?.phone;
    if (customerPhone) {
      const raw = (booking.serviceType || '').toLowerCase();
      let serviceType: string | null = null;
      if (raw.includes('coating')) serviceType = 'coating';
      else if (raw.includes('repaint') || raw.includes('cat')) serviceType = 'repaint';
      else if (raw.includes('detail') || raw.includes('poles') || raw.includes('cuci')) serviceType = 'detailing';

      await prisma.customerContext.updateMany({
        where: { phone: customerPhone },
        data: {
          reviewFollowUpSent: false,
          lastServiceAt: booking.bookingDate,
          ...(serviceType ? { lastServiceType: serviceType } : {}),
        }
      });
      console.log(`[Payment] Reset review flags for ${customerPhone} (serviceType=${serviceType})`);
    }

    // Meta CAPI - Purchase event
    sendCapiEvent({
      eventName: 'Purchase',
      eventId: `pay_${booking.id}_${Date.now()}`,
      userData: {
        phone: customerPhone || booking.customerPhone,
        firstName: booking.customerName || booking.customer?.name,
      },
      customData: {
        value: finalAmount,
        currency: 'IDR',
        content_name: booking.serviceType || 'Service',
        content_type: 'product',
      }
    });

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