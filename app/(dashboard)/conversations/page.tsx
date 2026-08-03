import { Suspense } from 'react';
import prisma from '@/lib/prisma';
import ConversationsClient from './ConversationsClient';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

interface InitialData {
  conversations: Conversation[];
  hasMore: boolean;
  total: number;
}

/**
 * Server-side initial data fetch.
 * Runs on Vercel edge — same network as Supabase → near-zero latency.
 * The client hook receives this as initialData and skips its own fetch,
 * eliminating the browser-visible loading delay entirely.
 */
async function getInitialData(): Promise<InitialData> {
  try {
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { OR: [{ messages: { some: {} } }, { bookings: { some: {} } }] },
        take: PAGE_SIZE,
        skip: 0,
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
          _count: { select: { bookings: true, messages: true } },
        },
      }),
      prisma.customer.count({
        where: { OR: [{ messages: { some: {} } }, { bookings: { some: {} } }] },
      }),
    ]);

    const conversations: Conversation[] = customers
      .filter(c => c.messages.length > 0 || c.bookings.length > 0)
      .map(c => {
        const lastMessage = c.messages[0];
        const lastCustomerMessage = c.messages.find(
          m => m.role === 'user' || m.role === 'customer'
        );
        const lastBooking = c.bookings[0];
        return {
          id: c.id,
          customerId: c.id,
          customerName: c.name || 'Unknown',
          customerPhone: c.phone || '',
          phoneReal: c.phoneReal || '',
          channel: 'whatsapp' as const,
          lastMessage: c.lastMessage || lastMessage?.content || '',
          lastMessageRole: lastMessage?.role || 'assistant',
          lastMessageTime: c.lastMessageAt
            ? c.lastMessageAt.getTime()
            : (lastMessage?.createdAt.getTime() || 0),
          lastCustomerMessageTime: lastCustomerMessage?.createdAt
            ? new Date(lastCustomerMessage.createdAt).getTime()
            : undefined,
          unreadCount: 0,
          label: c.status || undefined,
          aiState: {
            enabled: !c.aiPaused,
            pausedUntil: c.aiPausedUntil
              ? new Date(c.aiPausedUntil).getTime()
              : undefined,
            reason: c.aiPauseReason || undefined,
          },
          platformId: c.phone,
          profilePicUrl: c.profilePicUrl || undefined,
          totalSpending: c.totalSpending || 0,
          customerContext: c.customerContext,
          lastBooking: lastBooking
            ? {
                id: lastBooking.id,
                serviceType: lastBooking.serviceType,
                bookingDate: lastBooking.bookingDate.toISOString(),
                status: lastBooking.status,
              }
            : null,
        };
      })
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    return {
      conversations,
      hasMore: PAGE_SIZE < total,
      total,
    };
  } catch (error) {
    console.error('[ConversationsPage] SSR fetch error:', error);
    return { conversations: [], hasMore: false, total: 0 };
  }
}

export default async function ConversationsPage() {
  const { conversations, hasMore, total } = await getInitialData();

  return (
    <ConversationsClient
      initialConversations={conversations}
      initialHasMore={hasMore}
      initialTotal={total}
    />
  );
}
