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
    // NOTE: We order by updatedAt here as a rough initial sort,
    // then re-sort by actual latest DirectMessage time in the transform step.
    // This ensures correct ordering even when Customer.lastMessageAt is stale
    // (e.g. after a backfill script that didn't update lastMessageAt).
    const customers = await prisma.customer.findMany({
      take: limit,
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
          take: 5
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
        customerContext: true,
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
        const lastCustomerMessage = c.messages.find(m => m.role === 'user' || m.role === 'customer');
        const lastBooking = c.bookings[0];
        
        // The c.phone already contains the suffix (@c.us or @lid) from DB reset
        const customerPhone = c.phone;
        
        // Use the actual latest DirectMessage time as the source of truth
        const actualLastMessageAt = lastMessage?.createdAt?.toISOString() || c.lastMessageAt?.toISOString() || c.updatedAt.toISOString();
        
        return {
          id: c.id,
          customerId: c.id,
          phone: customerPhone,
          customerPhone: customerPhone,
          phoneReal: c.phoneReal || '',
          name: c.name || c.phone,
          profilePicUrl: c.profilePicUrl,
          lastMessage: lastMessage?.content || null,
          lastMessageRole: lastMessage?.role || null,
          lastMessageAt: actualLastMessageAt,
          lastCustomerMessageAt: lastCustomerMessage?.createdAt?.toISOString() || null,
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
          customerContext: c.customerContext,
        };
      })
      // Sort by actual last message time (newest first)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

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