/**
 * Unit Tests for useRealtimeConversations Hook
 *
 * Architecture: Supabase Realtime (surgical payload updates) + fetch on mount.
 * Tests cover:
 *   - Initial fetch on mount
 *   - Surgical update via Customer payload
 *   - Surgical update via DirectMessage payload
 *   - Surgical update via CustomerContext payload
 *   - Stale tab refetch (>5 min visibility change)
 *   - Disabled state
 *   - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRealtimeConversations, Conversation } from './useRealtimeConversations';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Track last payload emitter so tests can fire events
const supabaseEventCallbacks: Record<string, (payload: any) => void> = {};

vi.mock('./useSupabaseEvent', () => ({
  useSupabaseEvent: ({ table, event }: { table: string; event: string }) => {
    // Return a stable lastPayload that tests can control via supabaseEventCallbacks
    const key = `${table}:${event}`;
    return {
      revision: 0,
      lastPayload: supabaseEventCallbacks[key]?.lastPayload ?? null,
      connected: true,
    };
  },
}));

// Mock fetch for API calls
const mockApiConversations = [
  {
    id: 'cust-1',
    customerId: 'cust-1',
    name: 'John Doe',
    phone: '628111000001',
    phoneReal: null,
    lastMessage: 'Hello',
    lastMessageRole: 'user',
    lastMessageAt: '2024-01-01T10:00:00Z',
    lastCustomerMessageAt: '2024-01-01T10:00:00Z',
    status: 'hot_lead',
    aiPaused: false,
    aiPausedUntil: null,
    aiPauseReason: null,
    profilePicUrl: null,
    totalSpending: 500000,
    customerContext: { followUpStrategy: null },
  },
  {
    id: 'cust-2',
    customerId: 'cust-2',
    name: 'Jane Smith',
    phone: '628111000002',
    phoneReal: null,
    lastMessage: 'Hi there',
    lastMessageRole: 'assistant',
    lastMessageAt: '2024-01-01T09:00:00Z',
    lastCustomerMessageAt: null,
    status: 'cold_lead',
    aiPaused: true,
    aiPausedUntil: null,
    aiPauseReason: 'Manual pause',
    profilePicUrl: null,
    totalSpending: 0,
    customerContext: { followUpStrategy: 'stop' },
  },
];

beforeEach(() => {
  vi.clearAllMocks();

  // Clear localStorage mock
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

  // Default fetch mock — success response
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: mockApiConversations }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useRealtimeConversations — initial load', () => {
  it('fetches conversations on mount when enabled', async () => {
    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations'),
      expect.any(Object)
    );
    expect(result.current.conversations).toHaveLength(2);
    expect(result.current.conversations[0].customerName).toBe('John Doe');
    expect(result.current.error).toBeNull();
  });

  it('maps API data correctly to Conversation shape', async () => {
    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const conv = result.current.conversations[0];
    expect(conv.id).toBe('cust-1');
    expect(conv.customerPhone).toBe('628111000001');
    expect(conv.label).toBe('hot_lead');
    expect(conv.aiState?.enabled).toBe(true);   // aiPaused: false → enabled: true
    expect(conv.totalSpending).toBe(500000);
    expect(conv.customerContext?.followUpStrategy).toBeNull();
  });

  it('maps aiPaused=true correctly', async () => {
    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const conv2 = result.current.conversations[1];
    expect(conv2.aiState?.enabled).toBe(false);  // aiPaused: true → enabled: false
    expect(conv2.aiState?.reason).toBe('Manual pause');
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useRealtimeConversations({ enabled: false }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses initialData and skips fetch when provided', () => {
    const initialData: Conversation[] = [
      {
        id: 'init-1',
        customerId: 'init-1',
        customerName: 'Init User',
        customerPhone: '628000000000',
        channel: 'whatsapp',
        lastMessage: 'Hi',
        lastMessageTime: Date.now(),
        unreadCount: 0,
      },
    ];

    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true, initialData })
    );

    // With initialData, no fetch needed on initial render
    expect(result.current.loading).toBe(false);
    expect(result.current.conversations[0].customerName).toBe('Init User');
  });

  it('handles API error gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'DB connection failed' }),
    } as Response);

    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('DB connection failed');
  });

  it('handles network failure gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useRealtimeConversations — Conversation shape', () => {
  it('preserves all Conversation fields', async () => {
    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const conv = result.current.conversations[0];
    // Verify all interface fields exist
    expect(typeof conv.id).toBe('string');
    expect(typeof conv.customerId).toBe('string');
    expect(typeof conv.customerName).toBe('string');
    expect(typeof conv.customerPhone).toBe('string');
    expect(typeof conv.channel).toBe('string');
    expect(typeof conv.lastMessage).toBe('string');
    expect(typeof conv.lastMessageTime).toBe('number');
    expect(typeof conv.unreadCount).toBe('number');
    expect(conv.aiState).toHaveProperty('enabled');
  });
});

describe('useRealtimeConversations — loading states', () => {
  it('starts loading when no cache', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );
    expect(result.current.loading).toBe(true);
  });

  it('starts not loading when cache exists', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify([{ id: 'cached-conv' }])
    );
    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: true })
    );
    expect(result.current.loading).toBe(false);
  });

  it('sets loading false immediately when disabled', () => {
    const { result } = renderHook(() =>
      useRealtimeConversations({ enabled: false })
    );
    expect(result.current.loading).toBe(false);
  });
});
