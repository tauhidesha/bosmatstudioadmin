import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

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

    // Check if booking exists
    const existingBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true }
    });

    if (!existingBooking) {
      return NextResponse.json(
        { success: false, error: 'Booking tidak ditemukan' },
        { status: 404 }
      );
    }

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: status.toUpperCase(),
        adminNotes: remarks || existingBooking.adminNotes,
      }
    });

    // Handle status completion - update customer lastService + reset review flags
    if (status === 'COMPLETED' && existingBooking.status !== 'COMPLETED') {
      await prisma.customer.update({
        where: { id: existingBooking.customerId },
        data: { lastService: existingBooking.bookingDate }
      });

      // Reset CustomerContext so the scheduler's review follow-up fires 3 days later
      const customerPhone = existingBooking.customer?.phone;
      if (customerPhone) {
        // Derive a normalised service type for the rebooking engine
        const raw = (existingBooking.serviceType || '').toLowerCase();
        let serviceType: string | null = null;
        if (raw.includes('coating'))  serviceType = 'coating';
        else if (raw.includes('repaint') || raw.includes('cat'))  serviceType = 'repaint';
        else if (raw.includes('detail') || raw.includes('poles') || raw.includes('cuci'))  serviceType = 'detailing';

        await prisma.customerContext.updateMany({
          where: { phone: customerPhone },
          data: {
            reviewFollowUpSent: false,
            lastServiceAt: existingBooking.bookingDate,
            ...(serviceType ? { lastServiceType: serviceType } : {}),
          }
        });
        console.log(`[BookingStatus] Reset review flags for ${customerPhone} (serviceType=${serviceType})`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Status booking berhasil diupdate',
      bookingId,
      status: updatedBooking.status.toLowerCase()
    });
  } catch (error: any) {
    console.error(`Error updating booking status for ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}