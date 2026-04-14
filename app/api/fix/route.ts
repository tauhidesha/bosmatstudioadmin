import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const badBookings = await prisma.booking.findMany({
        where: {
          OR: [
            { status: 'SUCCESS' },
            { status: 'paid' }
          ],
          paymentStatus: {
            not: 'PAID'
          }
        }
      });
    
      let fixedCount = 0;
      for (const b of badBookings) {
        await prisma.booking.update({
          where: { id: b.id },
          data: {
            paymentStatus: 'PAID',
            amountPaid: b.totalAmount || b.subtotal || 0,
            status: 'paid' // standardize to 'paid'
          }
        });
        
        await prisma.transaction.updateMany({
            where: { bookingId: b.id, status: 'SUCCESS' },
            data: { amount: b.totalAmount || b.subtotal || 0 }
        });

        fixedCount++;
      }
    
      return NextResponse.json({ success: true, fixed: fixedCount, badBookings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
