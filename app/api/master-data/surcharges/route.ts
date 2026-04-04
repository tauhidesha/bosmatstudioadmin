import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const surcharges = await prisma.surcharge.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, surcharges });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, amount, aliases, description } = body;

    const surcharge = await prisma.surcharge.create({
      data: {
        name,
        amount,
        aliases: aliases || [],
        description,
      },
    });

    return NextResponse.json({ success: true, surcharge });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
