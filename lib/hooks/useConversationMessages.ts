/**
 * useConversationMessages Hook (Supabase Realtime)
 * 
 * BEFORE: Polled /api/conversation-history every 10 seconds (~864 MB/day egress!)
 * AFTER:  Subscribes to DirectMessage INSERT, fetches only on new messages (~2 MB/day)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseEvent } from './useSupabaseEvent';

export interface Message {
  id: string;
  conversationId: string;
  sender: 'customer' | 'ai' | 'admin';
  senderName?: string;
  content: string;
  timestamp: number;
  channel?: string;
  platformId?: string;
}

interface UseConversationMessagesOptions {
  conversationId?: string;
  enabled?: boolean;
}

interface UseConversationMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | null;
}

export function useConversationMessages(
  options: UseConversationMessagesOptions = {}
): UseConversationMessagesReturn {
  const { conversationId, enabled = true } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);

  // Subscribe to DirectMessage INSERT events
  const { revision } = useSupabaseEvent({
    table: 'DirectMessage',
    event: 'INSERT',
    enabled: enabled && !!conversationId,
  });

  const fetchMessages = useCallback(async () => {
    if (!conversationId || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const phone = conversationId.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
      const res = await fetch(`/api/conversation-history/${phone}?limit=200&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch messages');
      }

      const mappedData: Message[] = json.data.map((item: any, idx: number) => ({
        id: `msg-${idx}-${item.timestamp}`,
        conversationId: conversationId,
        sender: item.sender === 'user' ? 'customer' : (item.sender === 'ai' ? 'ai' : 'admin'),
        senderName: item.sender === 'user' ? 'Pelanggan' : (item.sender === 'ai' ? 'Zoya Bot' : 'Admin'),
        content: item.text,
        timestamp: new Date(item.timestamp).getTime(),
      }));

      setMessages(mappedData);
      setError(null);
    } catch (err: any) {
      console.error('[useConversationMessages] Error:', err);
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [conversationId]);

  // Fetch on mount + whenever Supabase emits a DirectMessage INSERT
  useEffect(() => {
    if (!enabled || !conversationId) {
      setLoading(false);
      setMessages([]);
      return;
    }
    fetchMessages();
  }, [conversationId, enabled, revision, fetchMessages]);

  return { messages, loading, error };
}
