'use client';

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  where,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  paymentMethod: string;
  date: Date;
  customerName?: string;
  customerNumber?: string;
  customerId?: string;
  createdAt: Date;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  transactionCount: number;
}

export function useFinanceData(daysLimit = 30) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    transactionCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    
    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysLimit);
    const thresholdTs = Timestamp.fromDate(dateThreshold);

    const q = query(
      collection(db, 'transactions'),
      where('date', '>=', thresholdTs),
      orderBy('date', 'desc'),
      firestoreLimit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let income = 0;
      let expense = 0;
      
      const items: Transaction[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const amount = data.amount || 0;
        
        if (data.type === 'income') income += amount;
        else if (data.type === 'expense') expense += amount;

        return {
          id: doc.id,
          ...data,
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        } as Transaction;
      });

      setTransactions(items);
      setSummary({
        totalIncome: income,
        totalExpense: expense,
        netProfit: income - expense,
        transactionCount: items.length,
      });
      setLoading(false);
    }, (err) => {
      console.error("Error fetching finance data:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [daysLimit]);

  return { transactions, summary, loading, error };
}
