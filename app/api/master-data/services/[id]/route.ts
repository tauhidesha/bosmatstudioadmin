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
    const { name, category, subcategory, summary, description, note, estimatedDuration, usesModelPricing, prices } = body;

    // Transaction to update service and its prices
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update service
      const service = await tx.service.update({
        where: { id },
        data: {
          name,
          category,
          subcategory,
          summary,
          description,
          note,
          estimatedDuration,
          usesModelPricing,
        },
      });

      // 2. If prices provided, sync them
      if (prices && Array.isArray(prices)) {
        // Simple approach: delete existing and recreate
        await tx.servicePrice.deleteMany({ where: { serviceId: id } });
        await tx.servicePrice.createMany({
          data: prices.map((p: any) => ({
            ...p,
            serviceId: id,
          })),
        });
      }

      return service;
    });

    return NextResponse.json({ success: true, service: result });
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
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
