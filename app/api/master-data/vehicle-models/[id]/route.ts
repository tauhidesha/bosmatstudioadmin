import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { modelName, brand, serviceSize, repaintSize, aliases, modelPrices } = body;

    const model = await prisma.vehicleModel.update({
      where: { id },
      data: {
        modelName,
        brand: brand?.toLowerCase(),
        serviceSize,
        repaintSize,
        aliases,
      },
    });

    // Handle model-specific prices if provided
    if (modelPrices && Array.isArray(modelPrices)) {
      for (const { serviceId, price } of modelPrices) {
        const existingPrice = await prisma.servicePrice.findFirst({
          where: {
            serviceId,
            vehicleModelId: id,
            size: null
          }
        });

        if (existingPrice) {
          await prisma.servicePrice.update({
            where: { id: existingPrice.id },
            data: { price }
          });
        } else {
          await prisma.servicePrice.create({
            data: {
              serviceId,
              vehicleModelId: id,
              price,
              size: null
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true, model });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.vehicleModel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
