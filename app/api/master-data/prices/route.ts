import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceId, size, vehicleModelId, price } = body;

    const nullSafeSize = size || null;
    const nullSafeVehicleModelId = vehicleModelId || null;

    let priceEntry = await prisma.servicePrice.findFirst({
      where: {
        serviceId,
        size: nullSafeSize,
        vehicleModelId: nullSafeVehicleModelId,
      }
    });

    if (priceEntry) {
      priceEntry = await prisma.servicePrice.update({
        where: { id: priceEntry.id },
        data: { price }
      });
    } else {
      priceEntry = await prisma.servicePrice.create({
        data: {
          serviceId,
          size: nullSafeSize,
          vehicleModelId: nullSafeVehicleModelId,
          price
        }
      });
    }

    return NextResponse.json({ success: true, price: priceEntry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
