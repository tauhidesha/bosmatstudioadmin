'use client';

import { useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { db } from '@/lib/auth/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddTransactionModal({ isOpen, onClose }: AddTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'income',
    amount: '',
    category: '',
    description: '',
    paymentMethod: 'transfer',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        ...formData,
        amount: Number(formData.amount),
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'admin_panel',
      });
      onClose();
      setFormData({
        type: 'income',
        amount: '',
        category: '',
        description: '',
        paymentMethod: 'transfer',
      });
    } catch (error) {
      console.error("Error adding transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Transaksi Baru">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['income', 'expense'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFormData({ ...formData, type: t })}
              className={`flex-1 py-2 rounded-lg text-[13px] font-black transition-all ${
                formData.type === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
            </button>
          ))}
        </div>

        <Input
          label="Nominal (IDR)"
          type="number"
          placeholder="Contoh: 500000"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          required
        />

        <Input
          label="Kategori"
          placeholder="Contoh: Repaint, Gaji, Listrik"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          required
        />

        <Input
          label="Keterangan"
          placeholder="Detail transaksi..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
        />

        <div className="space-y-1.5">
          <label className="text-[12px] font-black text-slate-400 uppercase tracking-wider">Metode Pembayaran</label>
          <select 
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-bold focus:ring-2 focus:ring-teal-500 outline-none transition-all"
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
          >
            <option value="transfer">Transfer</option>
            <option value="cash">Cash</option>
            <option value="qris">QRIS</option>
          </select>
        </div>

        <div className="pt-4 flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={onClose} type="button">Batal</Button>
          <Button className="flex-1 bg-teal-500 hover:bg-teal-600 rounded-xl h-12" type="submit" isLoading={loading}>
            Simpan Transaksi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
