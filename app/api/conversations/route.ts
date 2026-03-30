import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/conversations
// Returns list of recent conversations with last message info
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get customers with their latest messages
    const customers = await prisma.customer.findMany({
      take: limit,
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        phone: true,
        name: true,
        status: true,
        lastMessage: true,
        lastMessageAt: true,
        aiPaused: true,
        aiPauseReason: true,
        aiPausedUntil: true,
        totalSpending: true,
        profilePicUrl: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        bookings: {
          orderBy: { bookingDate: 'desc' },
          take: 1,
          select: {
            id: true,
            bookingDate: true,
            serviceType: true,
            status: true
          }
        },
        _count: {
          select: { bookings: true, messages: true }
        }
      }
    });

    // Transform to conversation format
    const conversations = customers
      .filter(c => c.messages.length > 0 || c.bookings.length > 0)
      .map(c => {
        const lastMessage = c.messages[0];
        const lastBooking = c.bookings[0];
        
        // The c.phone already contains the suffix (@c.us or @lid) from DB reset
        const customerPhone = c.phone;
        
        return {
          id: c.id,
          customerId: c.id,
          phone: customerPhone,
          customerPhone: customerPhone,
          name: c.name || c.phone,
          profilePicUrl: c.profilePicUrl,
          lastMessage: lastMessage?.content || null,
          lastMessageAt: lastMessage?.createdAt?.toISOString() || c.updatedAt.toISOString(),
          lastBooking: lastBooking ? {
            id: lastBooking.id,
            serviceType: lastBooking.serviceType,
            bookingDate: lastBooking.bookingDate.toISOString(),
            status: lastBooking.status
          } : null,
          bookingCount: c._count.bookings,
          messageCount: c._count.messages,
          status: c.status,
          aiPaused: c.aiPaused,
        };
      });

    return NextResponse.json({
      success: true,
      data: conversations
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}