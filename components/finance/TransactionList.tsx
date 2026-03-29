'use client';

import { Transaction } from '@/lib/hooks/useFinanceData';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

import Link from 'next/link';

interface TransactionListProps {
  transactions: Transaction[];
  loading?: boolean;
  className?: string;
  onEdit?: (t: Transaction) => void;
  onRefresh?: () => void;
}

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function TransactionList({ transactions, loading, className, onEdit, onRefresh }: TransactionListProps) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filtered = transactions.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus transaksi ini? Data booking terkait akan dihitung ulang.')) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/finance/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        onRefresh?.();
      } else {
        alert(json.error || 'Gagal menghapus transaksi');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Gagal menghapus transaksi');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className={cn("bg-[#1c1b1b] border border-white/5 overflow-hidden", className)}>
      {/* Header */}
      <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h4 className="text-sm font-headline font-black text-white uppercase tracking-widest italic">
            RECENT_TRANSACTIONS
          </h4>
          <span className="h-px flex-1 bg-white/5 hidden sm:block" />
        </div>
        
        <div className="flex gap-1 bg-[#0e0e0e] p-1">
          {(['all', 'income', 'expense'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                "px-4 py-1.5 text-[10px] font-headline font-black uppercase tracking-widest transition-all",
                filter === type 
                  ? "bg-[#FFFF00] text-[#131313]" 
                  : "text-white/40 hover:text-white"
              )}
            >
              {type === 'all' ? 'SEMUA' : type === 'income' ? 'MASUK' : 'KELUAR'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0e0e0e]">
              <th className="px-5 py-3 text-[10px] font-headline font-black text-zinc-500 uppercase tracking-widest">Tanggal</th>
              <th className="px-5 py-3 text-[10px] font-headline font-black text-zinc-500 uppercase tracking-widest">Customer</th>
              <th className="px-5 py-3 text-[10px] font-headline font-black text-zinc-500 uppercase tracking-widest">Deskripsi</th>
              <th className="px-5 py-3 text-[10px] font-headline font-black text-zinc-500 uppercase tracking-widest">Kategori</th>
              <th className="px-5 py-3 text-[10px] font-headline font-black text-zinc-500 uppercase tracking-widest">Metode</th>
              <th className="px-5 py-3 text-[10px] font-headline font-black text-zinc-500 uppercase tracking-widest text-right">Amount</th>
              <th className="px-5 py-3 text-[10px] font-headline font-black text-zinc-500 uppercase tracking-widest text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="px-5 py-4"><div className="h-4 bg-white/5 w-full" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-white/30 font-medium italic">Belum ada transaksi</td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="hover:bg-[#353534] transition-colors group">
                  <td className="px-5 py-3">
                    <p className="text-[12px] font-bold text-white">{format(new Date(t.createdAt), 'dd MMM yy')}</p>
                    <p className="text-[10px] text-white/40">{format(new Date(t.createdAt), 'HH:mm')}</p>
                  </td>
                  <td className="px-5 py-3">
                    {t.customer ? (
                      <div>
                        <p className="text-[12px] font-bold text-white">{t.customer.name}</p>
                        <Link 
                          href={`/conversations?id=${t.customer.phone}`}
                          className="text-[10px] text-[#FFFF00]/60 hover:text-[#FFFF00] transition-colors"
                        >
                          Lihat Chat
                        </Link>
                      </div>
                    ) : (
                      <span className="text-[11px] text-white/20">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-[12px] text-white/70 truncate max-w-[180px]">{t.description || '-'}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      "px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wider",
                      t.type === 'income' ? "bg-[#676700] text-[#e6e67a]" : "bg-zinc-800 text-[#ffb4ab]"
                    )}>{t.category || '-'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] text-white/40 capitalize">{t.paymentMethod || '-'}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <p className={cn("text-[13px] font-headline font-black tracking-tight", t.type === 'income' ? "text-[#FFFF00]" : "text-[#ffb4ab]")}>
                      {t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => onEdit?.(t)}
                        className="p-1.5 bg-[#2a2a2a] text-white/40 hover:bg-[#FFFF00]/10 hover:text-[#FFFF00] transition-all"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        disabled={isDeleting === t.id}
                        className={cn(
                          "p-1.5 bg-[#2a2a2a] text-white/40 hover:bg-[#ffb4ab]/10 hover:text-[#ffb4ab] transition-all",
                          isDeleting === t.id && "animate-pulse opacity-50"
                        )}
                        title="Hapus"
                      >
                        <span className="material-symbols-outlined text-[16px]">{isDeleting === t.id ? 'refresh' : 'delete'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
