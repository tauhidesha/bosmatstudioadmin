import { Suspense } from 'react';
import prisma from '@/lib/prisma';
import ConversationsClient from './ConversationsClient';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';

export const dynamic = 'force-dynamic';

async function getInitialConversations(): Promise<Conversation[]> {
  try {
    const limit = 100;
    const customers = await prisma.customer.findMany({
      take: limit,
      orderBy: { updatedAt: 'desc' },
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

    const conversations: Conversation[] = customers
      .filter(c => c.messages.length > 0 || c.bookings.length > 0)
      .map(c => {
        const lastMessage = c.messages[0];
        const lastCustomerMessage = c.messages.find(m => m.role === 'user' || m.role === 'customer');
        const lastBooking = c.bookings[0];
        
        
        return {
          id: c.id,
          customerId: c.id,
          customerName: c.name || 'Unknown',
          customerPhone: c.phone || '',
          channel: 'whatsapp' as const,
          lastMessage: c.lastMessage || lastMessage?.content || '',
          lastMessageRole: lastMessage?.role || 'assistant',
          lastMessageTime: c.lastMessageAt ? c.lastMessageAt.getTime() : (lastMessage?.createdAt.getTime() || 0),
          lastCustomerMessageTime: lastCustomerMessage?.createdAt ? new Date(lastCustomerMessage.createdAt).getTime() : undefined,
          unreadCount: 0,
          label: c.status || undefined,
          aiState: {
            enabled: !c.aiPaused,
            pausedUntil: c.aiPausedUntil ? new Date(c.aiPausedUntil).getTime() : undefined,
            reason: c.aiPauseReason || undefined,
          },
          platformId: c.phone,
          profilePicUrl: c.profilePicUrl || undefined,
          totalSpending: c.totalSpending || 0,
          customerContext: c.customerContext,
        };
      })
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    return conversations;
  } catch (error) {
    console.error('Error fetching initial conversations:', error);
    return [];
  }
}

export default async function ConversationsPage() {
  const initialConversations = await getInitialConversations();

  return (
    <ConversationsClient initialConversations={initialConversations} />
  );
}

