import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search');
    const brand = req.nextUrl.searchParams.get('brand');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100');

    const where: any = {};
    if (search) {
      where.OR = [
        { modelName: { contains: search, mode: 'insensitive' } },
        { aliases: { has: search } }
      ];
    }
    if (brand) {
      where.brand = brand.toLowerCase();
    }

    const models = await prisma.vehicleModel.findMany({
      where,
      take: limit,
      orderBy: { modelName: 'asc' },
    });

    return NextResponse.json({ success: true, models });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelName, brand, serviceSize, repaintSize, aliases, modelPrices } = body;

    const model = await prisma.vehicleModel.create({
      data: {
        modelName,
        brand: brand.toLowerCase(),
        serviceSize,
        repaintSize,
        aliases: aliases || [],
      },
    });

    // Handle model-specific prices if provided
    if (modelPrices && Array.isArray(modelPrices)) {
      for (const { serviceId, price } of modelPrices) {
        await prisma.servicePrice.create({
          data: {
            serviceId,
            vehicleModelId: model.id,
            price,
            size: null
          }
        });
      }
    }

    return NextResponse.json({ success: true, model });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
