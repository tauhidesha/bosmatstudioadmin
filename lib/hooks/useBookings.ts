/**
 * useBookings Hook (Supabase Realtime + Polling Fallback)
 * 
 * BEFORE: Polled /api/bookings every 30 seconds (~57 MB/day)
 * AFTER:  Subscribes to Booking changes, fetches only on events (~1 MB/day)
 *         + 10s polling fallback for reliability
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseEvent } from './useSupabaseEvent';
import { useAuth } from './useAuth';

export type BookingStatus = 'waiting' | 'pending' | 'in_progress' | 'done' | 'paid' | 'cancelled' | 'success';

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleInfo: string;
  bookingDate: string;
  bookingTime: string;
  status: BookingStatus;
  services: string | string[];
  serviceTypeRaw?: string;
  notes?: string;
  additionalService?: string;
  totalAmount?: number;
  amountPaid?: number;
  paymentStatus?: string;
  subtotal?: number;
  downPayment?: number;
  paymentMethod?: string;
  durationDays?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getIdToken } = useAuth();
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  // Load from cache initially for instant UI
  useEffect(() => {
    try {
      const cached = localStorage.getItem('cached-bookings');
      if (cached) {
        setBookings(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.error('Failed to parse cached bookings', e);
    }
  }, []);

  // Subscribe to Booking changes (INSERT, UPDATE, DELETE)
  const { revision } = useSupabaseEvent({
    table: 'Booking',
    event: '*',
  });

  const fetchBookings = useCallback(async () => {
    if (fetchingRef.current) return;
    
    // Debounce: skip if fetched within last 500ms
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    
    fetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      const token = await getIdToken();
      const res = await fetch('/api/bookings?limit=100', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch bookings');
      }

      setBookings(json.data as Booking[]);
      try {
        localStorage.setItem('cached-bookings', JSON.stringify(json.data));
      } catch (e) {
        console.error('Failed to save cached bookings', e);
      }
      setError(null);
    } catch (err: any) {
      console.error('[useBookings] Error:', err);
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [getIdToken]);

  // Fetch on mount + whenever Supabase emits a Booking event
  useEffect(() => {
    fetchBookings();
  }, [revision, fetchBookings]);

  // Polling fallback every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBookings();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchBookings]);

  const updateBookingStatus = async (id: string, newStatus: BookingStatus) => {
    try {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));

      const token = await getIdToken();
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const json = await res.json();
      if (!json.success) {
        await fetchBookings();
        throw new Error(json.error);
      }

      return true;
    } catch (err) {
      console.error('Error updating booking status:', err);
      throw err;
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/bookings?id=${id}`, { 
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setBookings(prev => prev.filter(b => b.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting booking:', err);
      throw err;
    }
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    try {
      const token = await getIdToken();
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, ...updates }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      return true;
    } catch (err) {
      console.error('Error updating booking:', err);
      throw err;
    }
  };

  const addBookingLocally = useCallback((newBooking: Booking) => {
    setBookings(prev => {
      // Prevent duplicates if Realtime already caught it
      if (prev.some(b => b.id === newBooking.id)) return prev;
      
      const newArray = [newBooking, ...prev];
      try {
        localStorage.setItem('cached-bookings', JSON.stringify(newArray));
      } catch (e) {}
      return newArray;
    });
  }, []);

  return { bookings, loading, error, updateBookingStatus, deleteBooking, updateBooking, addBookingLocally };
}
