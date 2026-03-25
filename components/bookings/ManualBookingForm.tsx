'use client';

import { useState } from 'react';
import Button from '@/components/shared/Button';
import { ApiClient } from '@/lib/api/client';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';

interface ManualBookingFormProps {
  initialData?: {
    customerName?: string;
    customerPhone?: string;
  };
  allConversations?: Conversation[];
  apiClient: ApiClient;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ManualBookingForm({
  initialData,
  allConversations,
  apiClient,
  onSuccess,
  onCancel,
}: ManualBookingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: initialData?.customerName || '',
    customerPhone: initialData?.customerPhone || '',
    serviceName: '',
    bookingDate: new Date().toISOString().split('T')[0],
    bookingTime: '10:00',
    vehicleInfo: '',
    notes: '',
    subtotal: 0,
    homeService: false,
  });

  const handleSelectCustomer = (id: string) => {
    const customer = allConversations?.find(c => c.id === id);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerName: customer.customerName,
        customerPhone: customer.customerPhone,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.createBooking(formData);
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Gagal membuat booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all placeholder:text-slate-300";
  const labelClass = "text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 px-0.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {allConversations && allConversations.length > 0 && (
        <div className="space-y-1 pb-3 border-b border-slate-100">
          <label className={`${labelClass} !text-teal-600`}>
            Pilih Dari Daftar Chat
          </label>
          <select
            onChange={(e) => handleSelectCustomer(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-800 text-white border-none rounded-xl text-[13px] font-bold focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
          >
            <option value="">-- Pilih Customer --</option>
            {allConversations.map(c => (
              <option key={c.id} value={c.id}>
                {c.customerName || 'No Name'} ({c.customerPhone})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Nama Pelanggan</label>
          <input
            required
            value={formData.customerName}
            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            className={inputClass}
            placeholder="Budi Sudarsono"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>No. WhatsApp</label>
          <input
            required
            value={formData.customerPhone}
            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            className={`${inputClass} font-mono`}
            placeholder="62812345678"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Info Kendaraan</label>
          <input
            required
            value={formData.vehicleInfo}
            onChange={(e) => setFormData({ ...formData, vehicleInfo: e.target.value })}
            className={inputClass}
            placeholder="Honda Vario 150"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Layanan</label>
          <input
            required
            value={formData.serviceName}
            onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
            className={inputClass}
            placeholder="Cuci Komplit, Ganti Oli"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Tanggal</label>
          <input
            required
            type="date"
            value={formData.bookingDate}
            onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Jam</label>
          <input
            required
            type="time"
            value={formData.bookingTime}
            onChange={(e) => setFormData({ ...formData, bookingTime: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Subtotal</label>
          <input
            type="number"
            value={formData.subtotal}
            onChange={(e) => setFormData({ ...formData, subtotal: parseInt(e.target.value) || 0 })}
            className={inputClass}
          />
        </div>
        <div className="flex items-end pb-1">
          <label htmlFor="hs-check" className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 w-full">
            <input 
              type="checkbox"
              id="hs-check"
              checked={formData.homeService}
              onChange={(e) => setFormData({ ...formData, homeService: e.target.checked })}
              className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/20"
            />
            <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Home Svc</span>
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Catatan</label>
        <input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className={inputClass}
          placeholder="Titip helm, parkir di depan..."
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          onClick={onCancel}
          variant="secondary"
          disabled={isSubmitting}
          className="flex-1 font-black h-11 rounded-xl bg-slate-100 border-none text-slate-500 hover:text-slate-700 text-[12px]"
        >
          BATAL
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="flex-[2] font-black h-11 rounded-xl shadow-lg shadow-primary/20 text-[12px]"
        >
          BUAT BOOKING
        </Button>
      </div>
    </form>
  );
}
