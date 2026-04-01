/**
 * useFinanceData Hook (Supabase Realtime)
 * 
 * BEFORE: Polled /api/finance every 30 seconds (~86 MB/day)
 * AFTER:  Subscribes to Transaction changes, fetches only on events (~2 MB/day)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseEvent } from './useSupabaseEvent';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  paymentMethod: string;
  createdAt: string | Date;
  customer?: { name: string; phone: string };
  customerName?: string;
  customerId?: string;
  bookingId?: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  transactionCount: number;
}

export function useFinanceData(daysLimit = 30, customerId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    transactionCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  // Subscribe to Transaction changes
  const { revision } = useSupabaseEvent({
    table: 'Transaction',
    event: '*',
  });

  const fetchFinanceData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const res = await fetch(`/api/finance?limit=500&days=${daysLimit}${customerId ? '&customerId='+customerId : ''}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch finance data');
      }

      const items: Transaction[] = json.data;
      
      let income = 0;
      let expense = 0;
      
      items.forEach(item => {
        if (item.type === 'income') income += item.amount;
        else if (item.type === 'expense') expense += item.amount;
      });

      setTransactions(items);
      setSummary({
        totalIncome: income,
        totalExpense: expense,
        netProfit: income - expense,
        transactionCount: items.length,
      });
      setError(null);
    } catch (err: any) {
      console.error('[useFinanceData] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [daysLimit, customerId]);

  // Fetch on mount + whenever Supabase emits a Transaction event
  useEffect(() => {
    fetchFinanceData();
  }, [revision, fetchFinanceData]);

  return { transactions, summary, loading, error, refresh: fetchFinanceData };
}
