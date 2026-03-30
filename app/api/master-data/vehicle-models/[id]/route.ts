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
    const { modelName, brand, serviceSize, repaintSize, aliases } = body;

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
