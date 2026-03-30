import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const number = params.number;
    
    if (!number) {
      return NextResponse.json(
        { success: false, error: 'Nomor WhatsApp tidak valid' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Normalize numeric part for prefix search
    const normalizedPhone = number.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
    
    // Find customer (handle both with and without suffix from DB reset)
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: number },
          { phone: { startsWith: normalizedPhone } }
        ]
      }
    });

    if (!customer) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Get messages for this customer
    const messages = await prisma.directMessage.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        content: true,
        senderId: true,
        role: true,
        mediaUrl: true,
        createdAt: true
      }
    });

    // Transform to the expected format
    const history = messages.map(msg => ({
      text: msg.content,
      sender: msg.role === 'user' ? 'user' : (msg.role === 'assistant' ? 'ai' : 'admin'),
      timestamp: msg.createdAt.toISOString(),
      mediaUrl: msg.mediaUrl
    }));

    return NextResponse.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    console.error(`Error fetching history for ${params.number}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}