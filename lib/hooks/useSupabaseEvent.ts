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

let channelCounter = 0;

export function useSupabaseEvent(options: UseSupabaseEventOptions): UseSupabaseEventReturn {
  const { table, schema = 'public', event = '*', filter, enabled = true } = options;

  const [revision, setRevision] = useState(0);
  const [lastPayload, setLastPayload] = useState<RealtimePostgresChangesPayload<any> | null>(null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Stable cleanup function
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Clean up any previous channel first
    cleanup();

    // Use unique channel name to prevent collisions (React StrictMode)
    const uniqueId = ++channelCounter;
    const channelName = `rt-${table}-${uniqueId}`;

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

    // Visibility handler — pause when tab hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab visible again — bump revision to trigger refetch
        setRevision(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, table, schema, event, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  return { revision, lastPayload, connected };
}
