import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const services = await prisma.service.findMany({
      include: {
        prices: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, services });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, subcategory, summary, description, note, estimatedDuration, usesModelPricing, prices } = body;

    const service = await prisma.service.create({
      data: {
        name,
        category,
        subcategory,
        summary,
        description,
        note,
        estimatedDuration,
        usesModelPricing,
        prices: {
          create: prices || [],
        },
      },
    });

    return NextResponse.json({ success: true, service });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
