'use client';

import { Transaction } from '@/lib/hooks/useFinanceData';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';

interface FinanceChartProps {
  transactions: Transaction[];
  loading?: boolean;
}

export default function FinanceChart({ transactions, loading }: FinanceChartProps) {
  if (loading) {
    return (
      <div className="bg-[#1c1b1b] border border-white/5 p-5 animate-pulse">
        <div className="h-6 w-48 bg-white/5 mb-8" />
        <div className="flex items-end justify-between h-[200px] gap-2 mt-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 bg-white/5" style={{ height: '40%' }} />
          ))}
        </div>
      </div>
    );
  }

  // Generate last 7 days data
  const chartData = [...Array(7)].map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayTransactions = transactions.filter(t => isSameDay(new Date(t.createdAt), date));
    
    const income = dayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const expense = dayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      date: format(date, 'EEE', { locale: id }),
      income,
      expense,
      profit: income - expense
    };
  });

  const maxVal = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 1000000);

  return (
    <div className="bg-[#1c1b1b] border border-white/5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h4 className="text-sm font-headline font-black text-white uppercase tracking-widest italic">
            WEEKLY_TREND
          </h4>
          <span className="h-px flex-1 bg-white/5 hidden sm:block" />
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="size-2 bg-[#FFFF00]" />
            <span className="text-[10px] font-headline font-bold text-white/40 uppercase tracking-widest">Masuk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 bg-[#ffb4ab]" />
            <span className="text-[10px] font-headline font-bold text-white/40 uppercase tracking-widest">Keluar</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end justify-between h-[200px] gap-2 sm:gap-4 relative px-2">
        {/* Y-Axis lines */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
          <div className="border-t border-white/5 w-full" />
          <div className="border-t border-white/5 w-full" />
          <div className="border-t border-white/5 w-full" />
        </div>

        {chartData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 relative group h-full">
            <div className="flex items-end gap-1 w-full flex-1 justify-center min-h-0">
              {/* Income bar */}
              <div 
                className="w-1.5 sm:w-3 bg-[#FFFF00] transition-all duration-700 hover:brightness-110 relative"
                style={{ height: `${(d.income / maxVal) * 100}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#131313] border border-white/10 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                  {d.income.toLocaleString('id-ID')}
                </div>
              </div>
              {/* Expense bar */}
              <div 
                className="w-1.5 sm:w-3 bg-[#ffb4ab] transition-all duration-700 hover:brightness-110 relative"
                style={{ height: `${(d.expense / maxVal) * 100}%` }}
              >
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#131313] border border-white/10 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                  {d.expense.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-headline font-black text-white/40 uppercase">{d.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
