import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        transaction: true
      }
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking tidak ditemukan' },
        { status: 404 }
      );
    }

    const totalAmount = body.totalAmount !== undefined ? body.totalAmount : (booking.totalAmount || booking.subtotal || 0);
    const amountPaidCurrent = booking.amountPaid || 0;
    const incrementAmount = totalAmount - amountPaidCurrent;

    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: { 
          paymentStatus: 'PAID', 
          amountPaid: totalAmount,
          status: 'DONE'
        }
      }),
      // Create transaction for income tracking
      prisma.transaction.create({
        data: {
          bookingId: id,
          customerId: booking.customerId,
          amount: totalAmount,
          type: 'income',
          status: 'SUCCESS',
          paymentMethod: booking.paymentMethod || 'transfer',
          description: `Pelunasan booking - ${booking.customerName || 'Customer'}`,
          category: booking.category || 'service',
          paymentDate: new Date(),
        }
      }),
      // Update totalSpending in Customer
      prisma.customer.update({
        where: { id: booking.customerId },
        data: { 
          totalSpending: { increment: Math.max(0, incrementAmount) }
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      message: `Booking ${id} berhasil ditandai sebagai lunas (total Rp ${totalAmount.toLocaleString()})`
    });
  } catch (error: any) {
    console.error('Error marking booking as paid:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
