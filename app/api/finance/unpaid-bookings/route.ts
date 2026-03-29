import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const unpaidBookings = await prisma.booking.findMany({
      where: {
        OR: [
          { paymentStatus: 'UNPAID' },
          { paymentStatus: 'PARTIAL' }
        ],
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        },
        vehicle: {
          select: {
            modelName: true,
            plateNumber: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: unpaidBookings
    });
  } catch (error: any) {
    console.error('Error fetching unpaid bookings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
