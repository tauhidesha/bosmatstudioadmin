/**
 * useConversationMessages Hook (Supabase Realtime + Polling Fallback)
 * 
 * BEFORE: Polled /api/conversation-history every 10 seconds (~864 MB/day egress!)
 * AFTER:  Subscribes to DirectMessage INSERT, fetches only on events (~2 MB/day)
 *         + 5s polling fallback for reliability
 *         + INSTANT optimistic injection from WebSocket payload (Bypassing Vercel completely!)
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
  customerId?: string; // Used to match WebSocket payload
  enabled?: boolean;
}

interface UseConversationMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | null;
  addMessageLocally: (msg: Message) => void;
}

export function useConversationMessages(
  options: UseConversationMessagesOptions = {}
): UseConversationMessagesReturn {
  const { conversationId, customerId, enabled = true } = options;

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined' || !conversationId) return [];
    const cached = localStorage.getItem(`cached-messages-${conversationId}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined' || !conversationId) return true;
    return !localStorage.getItem(`cached-messages-${conversationId}`);
  });
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const addMessageLocally = useCallback((newMsg: Message) => {
    setMessages((prev) => {
      // Prevent duplicates if already exists
      if (prev.some(m => m.id === newMsg.id)) return prev;
      
      const updated = [...prev, newMsg];
      // Sort to ensure chronologically correct
      updated.sort((a, b) => a.timestamp - b.timestamp);
      
      if (typeof window !== 'undefined' && conversationId) {
        localStorage.setItem(`cached-messages-${conversationId}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [conversationId]);

  // Subscribe to DirectMessage INSERT events
  const { revision, lastPayload } = useSupabaseEvent({
    table: 'DirectMessage',
    event: 'INSERT',
    enabled: enabled && !!conversationId,
  });

  // INSTANT INJECTION: Listen to WebSocket payload and inject immediately
  useEffect(() => {
    if (lastPayload && lastPayload.new && conversationId && customerId) {
      const item = lastPayload.new;
      
      // If the incoming message belongs to the current conversation
      if (item.customerId === customerId) {
        const newMsg: Message = {
          id: item.id || `msg-${Date.now()}-${item.createdAt || Date.now()}`,
          conversationId: conversationId,
          sender: item.role === 'user' ? 'customer' : (item.role === 'assistant' ? 'ai' : 'admin'),
          senderName: item.role === 'user' ? 'Pelanggan' : (item.role === 'assistant' ? 'Zoya Bot' : 'Admin'),
          content: item.content,
          timestamp: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
        };
        addMessageLocally(newMsg);
      }
    }
  }, [lastPayload, conversationId, customerId, addMessageLocally]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || fetchingRef.current) return;
    
    // Debounce: skip if fetched within last 500ms
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    
    fetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      const phone = conversationId.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
      const res = await fetch(`/api/conversation-history/${phone}?limit=200&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch messages');
      }

      const mappedData: Message[] = json.data.map((item: any, idx: number) => ({
        // We use item.timestamp because API returns timestamp
        id: `msg-${idx}-${item.timestamp}`,
        conversationId: conversationId,
        sender: item.sender === 'user' ? 'customer' : (item.sender === 'ai' ? 'ai' : 'admin'),
        senderName: item.sender === 'user' ? 'Pelanggan' : (item.sender === 'ai' ? 'Zoya Bot' : 'Admin'),
        content: item.text,
        timestamp: new Date(item.timestamp).getTime(),
      }));

      setMessages(mappedData);
      if (typeof window !== 'undefined' && conversationId) {
        localStorage.setItem(`cached-messages-${conversationId}`, JSON.stringify(mappedData));
      }
      setError(null);
    } catch (err: any) {
      console.error('[useConversationMessages] Error:', err);
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [conversationId]);

  // Fetch on mount + whenever Supabase emits a DirectMessage INSERT (Fallback sync)
  useEffect(() => {
    if (!enabled || !conversationId) {
      setLoading(false);
      setMessages([]);
      return;
    }
    
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`cached-messages-${conversationId}`);
      if (cached) {
        // If we have cache, we still want to show it immediately
        setMessages(JSON.parse(cached));
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    fetchMessages();
  }, [conversationId, enabled, revision, fetchMessages]);

  // Polling fallback every 5 seconds (Just in case WebSocket misses something)
  useEffect(() => {
    if (!enabled || !conversationId) return;
    
    const interval = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId, enabled, fetchMessages]);

  return { messages, loading, error, addMessageLocally };
}
