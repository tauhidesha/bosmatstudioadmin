import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const topCustomers = await prisma.customer.findMany({
      orderBy: {
        totalSpending: 'desc'
      },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        totalSpending: true,
        lastService: true,
        status: true,
        vehicles: {
          select: {
            modelName: true,
            plateNumber: true,
          },
          take: 1,
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: topCustomers
    });
  } catch (error: any) {
    console.error('Error fetching top customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
