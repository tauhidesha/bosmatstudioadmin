import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/conversations?limit=50&skip=0
// Returns paginated conversations with hasMore + total
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const skip  = parseInt(searchParams.get('skip')  || '0',   10);

    // Get customers with their latest messages
    // NOTE: We order by updatedAt as rough initial sort, then re-sort by
    // actual DirectMessage time in the transform. Ensures correct ordering even
    // when Customer.lastMessageAt is stale.
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        take: limit,
        skip,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          phone: true,
          phoneReal: true,
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
            take: 5,
          },
          bookings: {
            orderBy: { bookingDate: 'desc' },
            take: 1,
            select: {
              id: true,
              bookingDate: true,
              serviceType: true,
              status: true,
            },
          },
          customerContext: true,
          _count: {
            select: { bookings: true, messages: true },
          },
        },
      }),
      // Count only customers who have messages or bookings (mirrors filter below)
      prisma.customer.count({
        where: {
          OR: [
            { messages: { some: {} } },
            { bookings: { some: {} } },
          ],
        },
      }),
    ]);

    // Transform to conversation format
    const conversations = customers
      .filter(c => c.messages.length > 0 || c.bookings.length > 0)
      .map(c => {
        const lastMessage = c.messages[0];
        const lastCustomerMessage = c.messages.find(
          m => m.role === 'user' || m.role === 'customer'
        );
        const lastBooking = c.bookings[0];
        const customerPhone = c.phone;
        const actualLastMessageAt =
          lastMessage?.createdAt?.toISOString() ||
          c.lastMessageAt?.toISOString() ||
          c.updatedAt.toISOString();

        return {
          id: c.id,
          customerId: c.id,
          phone: customerPhone,
          customerPhone,
          phoneReal: c.phoneReal || '',
          name: c.name || c.phone,
          profilePicUrl: c.profilePicUrl,
          lastMessage: lastMessage?.content || null,
          lastMessageRole: lastMessage?.role || null,
          lastMessageAt: actualLastMessageAt,
          lastCustomerMessageAt:
            lastCustomerMessage?.createdAt?.toISOString() || null,
          lastBooking: lastBooking
            ? {
                id: lastBooking.id,
                serviceType: lastBooking.serviceType,
                bookingDate: lastBooking.bookingDate.toISOString(),
                status: lastBooking.status,
              }
            : null,
          bookingCount: c._count.bookings,
          messageCount: c._count.messages,
          status: c.status,
          aiPaused: c.aiPaused,
          customerContext: c.customerContext,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
      );

    return NextResponse.json({
      success: true,
      data: conversations,
      pagination: {
        skip,
        limit,
        total,
        hasMore: skip + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}