import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceId, size, vehicleModelId, price } = body;

    const priceEntry = await prisma.servicePrice.upsert({
      where: {
        serviceId_size_vehicleModelId: {
          serviceId,
          size: size || null,
          vehicleModelId: vehicleModelId || null,
        }
      },
      update: { price },
      create: {
        serviceId,
        size: size || null,
        vehicleModelId: vehicleModelId || null,
        price
      }
    });

    return NextResponse.json({ success: true, price: priceEntry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
