import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get('month'); // YYYY-MM
    const type = searchParams.get('type');
    const mode = searchParams.get('mode');

    const where: any = {};
    
    if (monthStr && monthStr !== 'undefined') {
      try {
        const date = parseISO(`${monthStr}-01`);
        if (isValid(date)) {
          where.paymentDate = {
            gte: startOfMonth(date),
            lte: endOfMonth(date),
          };
        }
      } catch (e) {
        console.warn('Invalid month format:', monthStr);
      }
    }
    
    if (type && type !== 'all') {
      where.type = type.toLowerCase();
    }
    
    if (mode && mode !== 'all') {
      where.paymentMethod = {
        equals: mode,
        mode: 'insensitive'
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          }
        },
        booking: {
          select: {
            serviceType: true,
            plateNumber: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: transactions
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
