'use client';

import { useState } from 'react';
import { useFinanceData } from '@/lib/hooks/useFinanceData';
import FinanceStats from './FinanceStats';
import FinanceChart from './FinanceChart';
import TransactionList from './TransactionList';
import UnpaidBookingsList from './UnpaidBookingsList';
import AddTransactionModal from './AddTransactionModal';
import { Transaction } from '@/lib/hooks/useFinanceData';
import { Receipt } from 'lucide-react';

export default function FinanceDashboard() {
  const months = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }

  const [timeframe, setTimeframe] = useState<string | number>(months[0].value);
  const { transactions, summary, loading, refresh } = useFinanceData(timeframe);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 bg-[#131313] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline font-black text-[#FFFF00] uppercase tracking-tight text-2xl italic">
            FINANCE_MANAGEMENT
          </h1>
          <p className="text-white/40 font-headline text-[10px] uppercase tracking-widest mt-1">
            Lacak pemasukan, pengeluaran, dan profit Bosmat Studio
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-[#1c1b1b] border border-white/10 text-white font-headline text-xs h-10 px-4 focus:outline-none focus:ring-1 focus:ring-[#FFFF00]/30 cursor-pointer"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
            <option value="all">Semua Waktu</option>
          </select>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FFFF00] text-[#131313] font-headline font-black text-xs uppercase tracking-widest px-5 h-10 flex items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            TAMBAH
          </button>
        </div>
      </div>

      {/* Stats */}
      <FinanceStats summary={summary} loading={loading} />

      {/* Unpaid Bookings */}
      <div className="bg-neutral-900/20 border border-white/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="size-4 text-[#FFFF00]" />
          <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Tagihan Belum Lunas</h2>
        </div>
        <UnpaidBookingsList />
      </div>

      {/* Content — stacked layout */}
      <div className="flex flex-col gap-6">
        <TransactionList 
          transactions={transactions} 
          loading={loading} 
          onEdit={handleEdit}
          onRefresh={refresh}
        />
        <FinanceChart transactions={transactions} loading={loading} />
      </div>

      {/* Modal */}
      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }} 
        onSuccess={refresh}
        editData={editingTransaction}
      />
    </div>
  );
}
