'use client';

import { FinanceSummary } from '@/lib/hooks/useFinanceData';
import { cn } from '@/lib/utils';

interface FinanceStatsProps {
  summary: FinanceSummary;
  loading?: boolean;
  className?: string;
}

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function FinanceStats({ summary, loading, className }: FinanceStatsProps) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 bg-[#1c1b1b] border border-white/5 animate-pulse">
            <div className="size-10 bg-white/5 mb-4" />
            <div className="h-3 w-20 bg-white/5 mb-2" />
            <div className="h-8 w-32 bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Pemasukan',
      value: formatIDR(summary.totalIncome),
      icon: 'trending_up',
      valueColor: 'text-[#FFFF00]',
      iconBg: 'bg-[#FFFF00]/10',
      iconColor: 'text-[#FFFF00]',
    },
    {
      label: 'Total Pengeluaran',
      value: formatIDR(summary.totalExpense),
      icon: 'trending_down',
      valueColor: 'text-[#ffb4ab]',
      iconBg: 'bg-[#ffb4ab]/10',
      iconColor: 'text-[#ffb4ab]',
    },
    {
      label: 'Profit Bersih',
      value: formatIDR(summary.netProfit),
      icon: 'payments',
      valueColor: summary.netProfit >= 0 ? 'text-[#FFFF00]' : 'text-[#ffb4ab]',
      iconBg: summary.netProfit >= 0 ? 'bg-[#FFFF00]/10' : 'bg-[#ffb4ab]/10',
      iconColor: summary.netProfit >= 0 ? 'text-[#FFFF00]' : 'text-[#ffb4ab]',
    },
    {
      label: 'Jumlah Transaksi',
      value: summary.transactionCount.toString(),
      icon: 'receipt_long',
      valueColor: 'text-white',
      iconBg: 'bg-white/5',
      iconColor: 'text-white/40',
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {stats.map((stat, i) => (
        <div 
          key={i}
          className="bg-[#1c1b1b] border border-white/5 p-4 flex flex-col justify-between"
        >
          <div className="flex items-center gap-2">
            <div className={cn("p-2", stat.iconBg)}>
              <span className={cn("material-symbols-outlined block text-[20px]", stat.iconColor)}>
                {stat.icon}
              </span>
            </div>
            <p className="text-[10px] font-headline font-black text-white/40 uppercase tracking-widest">
              {stat.label}
            </p>
          </div>
          <div className="mt-3">
            <span className={cn("font-headline font-black text-2xl tracking-tight", stat.valueColor)}>
              {stat.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
