/**
 * useRealtimeConversations Hook (Supabase Realtime — Surgical Payload Updates + Pagination)
 *
 * Strategy:
 * - Initial load: fetch first page (50) from /api/conversations
 * - loadMore(): append next page (called by ConversationList infinite scroll)
 * - Customer UPDATE  → surgically update matching conversation from payload (no API call)
 * - DirectMessage INSERT → update lastMessage/lastMessageTime from payload (no API call)
 * - CustomerContext UPDATE → update followUpStrategy from payload (no API call)
 * - Tab visibility: refetch page 1 only if tab was hidden for >5 minutes
 *
 * Egress: ~1 row per event (payload) instead of 100 rows per event (full fetch)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseEvent } from './useSupabaseEvent';

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  phoneReal?: string;
  channel: 'whatsapp' | 'instagram' | 'messenger';
  lastMessage: string;
  lastMessageRole?: string;
  lastMessageTime: number;
  lastCustomerMessageTime?: number;
  unreadCount: number;
  label?: string;
  aiState?: {
    enabled: boolean;
    pausedUntil?: number;
    reason?: string;
  };
  platformId?: string;
  profilePicUrl?: string;
  totalSpending?: number;
  customerContext?: any;
}

interface UseRealtimeConversationsOptions {
  enabled?: boolean;
  initialData?: Conversation[];
  /** Passed from SSR — avoids double fetch on initial mount */
  initialHasMore?: boolean;
  initialTotal?: number;
}

interface UseRealtimeConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  error: Error | null;
  loadMore: () => void;
}

/** Number of conversations per page */
const PAGE_SIZE = 50;

/** Map raw API response item → Conversation */
function mapApiItem(item: any): Conversation {
  return {
    id: item.id,
    customerId: item.customerId,
    customerName: item.name,
    customerPhone: item.phone,
    phoneReal: item.phoneReal || '',
    channel: 'whatsapp',
    lastMessage: item.lastMessage || 'No messages yet',
    lastMessageRole: item.lastMessageRole,
    lastMessageTime: new Date(item.lastMessageAt).getTime(),
    lastCustomerMessageTime: item.lastCustomerMessageAt
      ? new Date(item.lastCustomerMessageAt).getTime()
      : undefined,
    unreadCount: 0,
    label: item.status,
    aiState: {
      enabled: !item.aiPaused,
      pausedUntil: item.aiPausedUntil ? new Date(item.aiPausedUntil).getTime() : undefined,
      reason: item.aiPauseReason,
    },
    platformId: item.phone,
    profilePicUrl: item.profilePicUrl,
    totalSpending: item.totalSpending || 0,
    customerContext: item.customerContext,
  };
}

/** 5 minutes in ms — threshold to consider tab-hidden data as stale */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function useRealtimeConversations(
  options: UseRealtimeConversationsOptions = {}
): UseRealtimeConversationsReturn {
  const { enabled = true, initialData, initialHasMore = false, initialTotal = 0 } = options;

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (initialData) return initialData;
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('cached-conversations');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(() => {
    // SSR provided data → no loading state on mount
    if (initialData) return false;
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem('cached-conversations');
  });

  const [loadingMore, setLoadingMore] = useState(false);
  // Bootstrap hasMore/total from SSR so the counter shows immediately
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal || (initialData?.length ?? 0));
  const [error, setError] = useState<Error | null>(null);

  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(initialData ? Date.now() : 0);
  const loadedCountRef = useRef<number>(initialData?.length ?? 0);
  // Track whether we've ever fetched so we don't double-fetch when SSR provides data
  const hasFetchedRef = useRef<boolean>(!!initialData);

  // ─── Supabase Realtime subscriptions ────────────────────────────────────────

  const { lastPayload: customerPayload } = useSupabaseEvent({
    table: 'Customer',
    event: 'UPDATE',
    enabled,
  });

  const { lastPayload: messagePayload } = useSupabaseEvent({
    table: 'DirectMessage',
    event: 'INSERT',
    enabled,
  });

  const { lastPayload: contextPayload } = useSupabaseEvent({
    table: 'CustomerContext',
    event: 'UPDATE',
    enabled,
  });

  // ─── Full fetch (initial load) ────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    if (fetchingRef.current) return;

    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;

    fetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      const res = await fetch(
        `/api/conversations?limit=${PAGE_SIZE}&skip=0&t=${now}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch conversations');

      const mappedData: Conversation[] = json.data.map(mapApiItem);
      const pagination = json.pagination ?? {};

      setConversations(mappedData);
      setHasMore(pagination.hasMore ?? false);
      setTotal(pagination.total ?? mappedData.length);
      loadedCountRef.current = mappedData.length;

      try {
        localStorage.setItem('cached-conversations', JSON.stringify(mappedData));
      } catch { /* storage full */ }

      setError(null);
    } catch (err: any) {
      console.error('[useRealtimeConversations] Fetch error:', err);
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // ─── Load next page (called by infinite scroll) ───────────────────────────

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || fetchingRef.current) return;

    setLoadingMore(true);
    const skip = loadedCountRef.current;

    try {
      const res = await fetch(
        `/api/conversations?limit=${PAGE_SIZE}&skip=${skip}&t=${Date.now()}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load more');

      const newItems: Conversation[] = json.data.map(mapApiItem);
      const pagination = json.pagination ?? {};

      setConversations(prev => {
        // Dedupe by id (in case realtime already added some of these)
        const existingIds = new Set(prev.map(c => c.id));
        const fresh = newItems.filter(c => !existingIds.has(c.id));
        return [...prev, ...fresh];
      });

      setHasMore(pagination.hasMore ?? false);
      setTotal(pagination.total ?? 0);
      loadedCountRef.current = skip + newItems.length;
    } catch (err: any) {
      console.error('[useRealtimeConversations] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  // ─── Initial fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    // Skip initial fetch if SSR already provided data.
    // hasFetchedRef prevents double-fetch on mount.
    if (hasFetchedRef.current) return;
    fetchConversations();
  }, [enabled, fetchConversations]);

  // ─── Surgical update: Customer UPDATE ────────────────────────────────────

  useEffect(() => {
    if (!customerPayload?.new) return;
    const row = customerPayload.new as any;
    console.log('[Realtime] Customer UPDATE →', row.id);

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === row.id);
      if (idx === -1) {
        fetchConversations();
        return prev;
      }
      const existing = prev[idx];
      const next = [...prev];
      next[idx] = {
        ...existing,
        customerName: row.name ?? existing.customerName,
        customerPhone: row.phone ?? existing.customerPhone,
        phoneReal: row.phoneReal ?? existing.phoneReal,
        profilePicUrl: row.profilePicUrl ?? existing.profilePicUrl,
        totalSpending: row.totalSpending ?? existing.totalSpending,
        label: row.status ?? existing.label,
        lastMessage: row.lastMessage ?? existing.lastMessage,
        lastMessageTime: row.lastMessageAt
          ? new Date(row.lastMessageAt).getTime()
          : existing.lastMessageTime,
        aiState: {
          enabled: typeof row.aiPaused === 'boolean'
            ? !row.aiPaused
            : (existing.aiState?.enabled ?? true),
          pausedUntil: row.aiPausedUntil
            ? new Date(row.aiPausedUntil).getTime()
            : undefined,
          reason: row.aiPauseReason ?? existing.aiState?.reason,
        },
      };
      return next;
    });
  }, [customerPayload, fetchConversations]);

  // ─── Surgical update: DirectMessage INSERT ───────────────────────────────

  useEffect(() => {
    if (!messagePayload?.new) return;
    const msg = messagePayload.new as any;
    console.log('[Realtime] DirectMessage INSERT → customerId:', msg.customerId);

    setConversations(prev =>
      prev.map(c => {
        if (c.id !== msg.customerId) return c;
        return {
          ...c,
          lastMessage: msg.content ?? c.lastMessage,
          lastMessageRole: msg.role ?? c.lastMessageRole,
          lastMessageTime: msg.createdAt
            ? new Date(msg.createdAt).getTime()
            : c.lastMessageTime,
        };
      })
    );
  }, [messagePayload]);

  // ─── Surgical update: CustomerContext UPDATE ─────────────────────────────

  useEffect(() => {
    if (!contextPayload?.new) return;
    const ctx = contextPayload.new as any;
    console.log('[Realtime] CustomerContext UPDATE → phone:', ctx.phone);

    setConversations(prev =>
      prev.map(c => {
        if (c.id !== ctx.id && c.customerPhone !== ctx.phone) return c;
        return {
          ...c,
          customerContext: {
            ...c.customerContext,
            followUpStrategy: ctx.followUpStrategy,
            followUpCount: ctx.followUpCount,
            lastFollowUpAt: ctx.lastFollowUpAt,
          },
        };
      })
    );
  }, [contextPayload]);

  // ─── Tab visibility: refetch page 1 only if data is stale (>5 minutes) ───

  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const staleSince = Date.now() - lastFetchRef.current;
        if (staleSince > STALE_THRESHOLD_MS) {
          console.log(`[Realtime] Tab visible after ${Math.round(staleSince / 1000)}s — refetching`);
          fetchConversations();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, fetchConversations]);

  return { conversations, loading, loadingMore, hasMore, total, error, loadMore };
}
