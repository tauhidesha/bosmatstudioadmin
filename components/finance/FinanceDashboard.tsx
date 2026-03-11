'use client';

import { useState } from 'react';
import { useFinanceData } from '@/lib/hooks/useFinanceData';
import FinanceStats from './FinanceStats';
import TransactionList from './TransactionList';
import AddTransactionModal from './AddTransactionModal';
import Button from '@/components/shared/Button';

export default function FinanceDashboard() {
  const { transactions, summary, loading } = useFinanceData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Finance Management</h1>
          <p className="text-slate-500 font-medium text-[14px]">Lacak pemasukan, pengeluaran, dan profit Bosmat Studio.</p>
        </div>
        
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white hover:bg-slate-800 rounded-2xl px-6 h-12 shadow-lg shadow-slate-900/10 flex items-center gap-2 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tambah Transaksi
        </Button>
      </div>

      <FinanceStats summary={summary} />

      <div className="grid grid-cols-1 gap-8">
        <TransactionList transactions={transactions} loading={loading} />
      </div>

      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
