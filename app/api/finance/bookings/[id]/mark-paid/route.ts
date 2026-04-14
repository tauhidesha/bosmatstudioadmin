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

    const transactionsToRun: any[] = [
      prisma.booking.update({
        where: { id },
        data: { 
          paymentStatus: 'PAID', 
          amountPaid: totalAmount,
          status: 'paid' // synchronize with other flows
        }
      })
    ];

    if (incrementAmount > 0) {
      // Create transaction for income tracking for the remaining balance
      transactionsToRun.push(
        prisma.transaction.create({
          data: {
            bookingId: id,
            customerId: booking.customerId,
            amount: incrementAmount,
            type: 'income',
            status: 'SUCCESS',
            paymentMethod: booking.paymentMethod || 'transfer',
            description: `Pelunasan booking - ${booking.customerName || 'Customer'}`,
            category: booking.category || 'service',
            paymentDate: new Date(),
          }
        })
      );
      
      // Update totalSpending in Customer
      transactionsToRun.push(
        prisma.customer.update({
          where: { id: booking.customerId },
          data: { 
            totalSpending: { increment: incrementAmount }
          }
        })
      );
    }
    
    await prisma.$transaction(transactionsToRun);

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
