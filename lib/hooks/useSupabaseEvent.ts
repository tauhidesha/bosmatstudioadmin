/**
 * useSupabaseEvent Hook
 * 
 * Subscribes to Supabase Realtime changes on a specific table.
 * Returns a revision counter that increments on every INSERT/UPDATE/DELETE.
 * Consumer hooks watch this counter to trigger re-fetches.
 * 
 * Also pauses subscription when tab is hidden to save bandwidth.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-realtime';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseSupabaseEventOptions {
  table: string;
  schema?: string;
  event?: PostgresEvent;
  filter?: string; // e.g. "customerId=eq.abc123"
  enabled?: boolean;
}

interface UseSupabaseEventReturn {
  /** Increments on every matching DB event */
  revision: number;
  /** Latest event payload (for optimistic updates) */
  lastPayload: RealtimePostgresChangesPayload<any> | null;
  /** Whether the subscription is active */
  connected: boolean;
}

export function useSupabaseEvent(options: UseSupabaseEventOptions): UseSupabaseEventReturn {
  const { table, schema = 'public', event = '*', filter, enabled = true } = options;

  const [revision, setRevision] = useState(0);
  const [lastPayload, setLastPayload] = useState<RealtimePostgresChangesPayload<any> | null>(null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const visibleRef = useRef(true);

  const subscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `realtime-${table}${filter ? `-${filter}` : ''}`;

    const channelConfig: any = {
      event,
      schema,
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload: RealtimePostgresChangesPayload<any>) => {
        console.log(`[Realtime] ${payload.eventType} on ${table}`, payload.new ? `id=${(payload.new as any).id}` : '');
        setRevision(prev => prev + 1);
        setLastPayload(payload);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ✅ Subscribed to ${table}${filter ? ` (${filter})` : ''}`);
        }
      });

    channelRef.current = channel;
  }, [table, schema, event, filter]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setConnected(false);
    }
  }, []);

  // Visibility-based subscription management
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      visibleRef.current = visible;

      if (visible) {
        // Tab became visible — resubscribe and bump revision to trigger refetch
        subscribe();
        setRevision(prev => prev + 1);
      } else {
        // Tab hidden — unsubscribe to save bandwidth
        unsubscribe();
      }
    };

    // Initial subscription
    subscribe();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, [enabled, subscribe, unsubscribe]);

  return { revision, lastPayload, connected };
}
