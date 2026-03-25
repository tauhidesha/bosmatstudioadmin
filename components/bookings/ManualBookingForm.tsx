'use client';

import { useState } from 'react';
import { ApiClient } from '@/lib/api/client';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';

const SERVICES = [
  { name: "Repaint Bodi Halus", category: "repaint" },
  { name: "Repaint Bodi Kasar", category: "repaint" },
  { name: "Repaint Velg", category: "repaint" },
  { name: "Repaint Cover CVT / Arm", category: "repaint" },
  { name: "Spot Repair", category: "repaint" },
  { name: "Detailing Mesin", category: "detailing" },
  { name: "Cuci Komplit", category: "detailing" },
  { name: "Poles Bodi Glossy", category: "detailing" },
  { name: "Full Detailing Glossy", category: "detailing" },
  { name: "Coating Motor Doff", category: "coating" },
  { name: "Coating Motor Glossy", category: "coating" },
  { name: "Complete Service Doff", category: "coating" },
  { name: "Complete Service Glossy", category: "coating" },
];

const CATEGORY_LABELS: Record<string, string> = {
  repaint: '🎨 Repaint',
  detailing: '✨ Detailing',
  coating: '🛡️ Coating',
};

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
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    customerName: initialData?.customerName || '',
    customerPhone: initialData?.customerPhone || '',
    invoiceName: '',
    bookingDate: new Date().toISOString().split('T')[0],
    bookingTime: '10:00',
    vehicleInfo: '',
    notes: '',
    subtotal: 0,
    dpAmount: 0,
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

  const toggleService = (name: string) => {
    setSelectedServices(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      alert('Pilih minimal 1 layanan');
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Create booking in Firestore
      const serviceName = selectedServices.join(', ');
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          serviceName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat booking');

      // 2. Auto-send DP invoice to customer WA
      try {
        await fetch('/api/bookings/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'invoice',
            customerName: formData.invoiceName || formData.customerName,
            customerPhone: formData.customerPhone,
            motorDetails: formData.vehicleInfo,
            items: serviceName,
            totalAmount: formData.subtotal,
            amountPaid: formData.dpAmount,
            notes: formData.notes,
          }),
        });
      } catch {
        console.warn('Invoice sending failed, booking was still created');
      }

      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Gagal membuat booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none transition-all placeholder:text-slate-300";
  const labelClass = "text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 px-0.5";

  const groupedServices = SERVICES.reduce((acc, svc) => {
    if (!acc[svc.category]) acc[svc.category] = [];
    acc[svc.category].push(svc);
    return acc;
  }, {} as Record<string, typeof SERVICES>);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Customer Selector */}
      {allConversations && allConversations.length > 0 && (
        <div className="space-y-1 pb-3 border-b border-slate-100">
          <label className={`${labelClass} !text-teal-600`}>
            Pilih Dari Daftar Chat
          </label>
          <select
            onChange={(e) => handleSelectCustomer(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-800 text-white border-none rounded-xl text-[13px] font-bold focus:ring-2 focus:ring-teal-500/20 outline-none cursor-pointer"
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

      {/* Name + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Nama Pelanggan</label>
          <input required value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} className={inputClass} placeholder="Budi Sudarsono" />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>No. WhatsApp</label>
          <input required value={formData.customerPhone} onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} className={`${inputClass} font-mono`} placeholder="62812345678" />
        </div>
      </div>

      {/* Invoice Name (optional) */}
      <div className="space-y-1">
        <label className={`${labelClass} !text-blue-500`}>Nama di Invoice <span className="text-slate-300 normal-case tracking-normal font-medium">(opsional, kalau beda dari nama WA)</span></label>
        <input value={formData.invoiceName} onChange={(e) => setFormData({ ...formData, invoiceName: e.target.value })} className={`${inputClass} !border-blue-200 !bg-blue-50/30`} placeholder="Kosongkan jika sama dengan nama pelanggan" />
      </div>

      {/* Vehicle */}
      <div className="space-y-1">
        <label className={labelClass}>Info Kendaraan</label>
        <input required value={formData.vehicleInfo} onChange={(e) => setFormData({ ...formData, vehicleInfo: e.target.value })} className={inputClass} placeholder="Honda Vario 150 (B 1234 XYZ)" />
      </div>

      {/* Service Selector */}
      <div className="space-y-2">
        <label className={labelClass}>Pilih Layanan</label>
        {Object.entries(groupedServices).map(([cat, services]) => (
          <div key={cat}>
            <p className="text-[11px] font-bold text-slate-500 mb-1.5">{CATEGORY_LABELS[cat] || cat}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {services.map(svc => {
                const isSelected = selectedServices.includes(svc.name);
                return (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => toggleService(svc.name)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700'
                    }`}
                  >
                    {isSelected && '✓ '}{svc.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {selectedServices.length > 0 && (
          <p className="text-[11px] text-teal-600 font-bold">
            Dipilih: {selectedServices.join(', ')}
          </p>
        )}
      </div>

      {/* Date, Time, Subtotal, DP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Tanggal</label>
          <input required type="date" value={formData.bookingDate} onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Jam</label>
          <input required type="time" value={formData.bookingTime} onChange={(e) => setFormData({ ...formData, bookingTime: e.target.value })} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Subtotal</label>
          <input type="number" value={formData.subtotal} onChange={(e) => setFormData({ ...formData, subtotal: parseInt(e.target.value) || 0 })} className={inputClass} placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className={`${labelClass} !text-amber-600`}>DP (Uang Muka)</label>
          <input type="number" value={formData.dpAmount} onChange={(e) => setFormData({ ...formData, dpAmount: parseInt(e.target.value) || 0 })} className={`${inputClass} !border-amber-200 !bg-amber-50/50`} placeholder="0" />
        </div>
      </div>

      {/* Home Service + Notes */}
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <label htmlFor="hs-check" className="flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <input type="checkbox" id="hs-check" checked={formData.homeService} onChange={(e) => setFormData({ ...formData, homeService: e.target.checked })} className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/20" />
          <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Home Service</span>
        </label>
        <div className="space-y-1">
          <input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={inputClass} placeholder="Catatan: titip helm, parkir depan..." />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 font-black text-[12px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting || selectedServices.length === 0}
          className="flex-[2] h-11 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-black text-[12px] uppercase tracking-wider shadow-lg shadow-teal-600/25 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Membuat & Mengirim Invoice...
            </span>
          ) : (
            '🗓️ Buat Booking + Kirim Invoice'
          )}
        </button>
      </div>
    </form>
  );
}
