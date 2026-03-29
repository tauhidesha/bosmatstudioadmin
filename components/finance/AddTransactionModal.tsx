'use client';

import React, { useState, useEffect, useMemo } from 'react';
import BaseModal from '@/components/shared/Modal';
import {
  MOTOR_DATABASE, SERVICES,
  getServicePrice, formatRupiah,
  type MotorModel, type ServiceItem
} from '@/lib/data/pricing';
import { Transaction } from '@/lib/hooks/useFinanceData';

// ─── KATEGORI DROPDOWN ───
// Income: kategori layanan yang menghasilkan revenue
const INCOME_CATEGORIES = [
  { value: 'Repaint', label: '🎨 Repaint' },
  { value: 'Detailing', label: '✨ Detailing' },
  { value: 'Coating', label: '🛡️ Coating' },
  { value: 'Cuci Motor', label: '🚿 Cuci Motor' },
  { value: 'Spot Repair', label: '🔧 Spot Repair' },
  { value: 'Custom Paint', label: '🖌️ Custom Paint' },
  { value: 'Home Service', label: '🏠 Home Service' },
  { value: 'Lainnya', label: '📦 Lainnya' },
];

// Expense: kategori pengeluaran operasional bengkel
const EXPENSE_CATEGORIES = [
  { value: 'Bahan Baku', label: '🪣 Bahan Baku (Cat, Thinner, dll)' },
  { value: 'Perlengkapan', label: '🧰 Perlengkapan & Tools' },
  { value: 'Gaji', label: '💵 Gaji & Upah' },
  { value: 'Listrik & Air', label: '⚡ Listrik & Air' },
  { value: 'Sewa Tempat', label: '🏢 Sewa Tempat' },
  { value: 'Transportasi', label: '🚗 Transportasi' },
  { value: 'Perawatan Alat', label: '🔩 Perawatan Alat' },
  { value: 'Marketing', label: '📢 Marketing & Promosi' },
  { value: 'Pajak & Admin', label: '📋 Pajak & Administrasi' },
  { value: 'Lainnya', label: '📦 Lainnya' },
];

interface Vehicle {
  id: string;
  modelName: string;
  plateNumber: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  vehicles: Vehicle[];
}

interface Booking {
  id: string;
  serviceType: string;
  vehicleModel: string | null;
  plateNumber: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  downPayment: number | null;
  amountPaid: number;
  paymentStatus: string;
  status: string;
  bookingDate: string;
}

interface CartItem {
  service: ServiceItem;
  autoPrice: number;
  manualPrice: number | null;
  spotCount?: number;
  spotPrice?: number;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: Transaction | null;
}

const STORAGE_KEY = 'add_transaction_draft';

export default function AddTransactionModal({ isOpen, onClose, editData }: AddTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [selectedMotor, setSelectedMotor] = useState<MotorModel | null>(null);
  const [motorSearch, setMotorSearch] = useState('');
  const [showMotorDropdown, setShowMotorDropdown] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [discountValue, setDiscountValue] = useState(0);
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [manualTotal, setManualTotal] = useState(0);
  const [customServiceDesc, setCustomServiceDesc] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [downPaymentEnabled, setDownPaymentEnabled] = useState(false);
  const [downPaymentAmount, setDownPaymentAmount] = useState(0);

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    paymentMethod: 'transfer',
    customerId: '',
    customerName: '',
    vehicleId: '',
    plateNumber: '',
    serviceType: '',
    bookingId: '',
  });

  // ─── Init / Edit ───
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          type: editData.type as 'income' | 'expense',
          amount: editData.amount.toString(),
          category: editData.category || '',
          description: (editData.description || '').replace(/^\[CAR\]\s*/, ''), // strip prefix
          paymentMethod: editData.paymentMethod || 'transfer',
          customerId: editData.customerId || '',
          customerName: editData.customerName || editData.customer?.name || '',
          vehicleId: '',
          plateNumber: '',
          serviceType: '',
          bookingId: editData.bookingId || '',
        });
        setCart([]);
        setUseManualTotal(true);
        setManualTotal(editData.amount);
        setMotorSearch('');
        setSelectedMotor(null);
        setSearchQuery(editData.customer?.name || '');
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const draft = JSON.parse(saved);
            setFormData(prev => ({ ...prev, ...draft.formData }));
            setCart(draft.cart || []);
            setDiscountType(draft.discountType || 'nominal');
            setDiscountValue(draft.discountValue || 0);
            setUseManualTotal(draft.useManualTotal || false);
            setManualTotal(draft.manualTotal || 0);
            setSelectedMotor(draft.selectedMotor || null);
            setMotorSearch(draft.motorSearch || '');
            setSearchQuery(draft.customerName || '');
          } catch (e) {
            console.error('Failed to load draft', e);
          }
        }
      }
    }
  }, [isOpen, editData]);

  useEffect(() => {
    if (isOpen && formData.customerId && !editData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formData, cart, discountType, discountValue, useManualTotal,
        manualTotal, selectedMotor, motorSearch, customerName: searchQuery
      }));
    }
  }, [formData, cart, discountType, discountValue, useManualTotal, manualTotal, selectedMotor, motorSearch, isOpen, editData]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCart([]);
    setDiscountValue(0);
    setUseManualTotal(false);
    setManualTotal(0);
    setSelectedMotor(null);
    setMotorSearch('');
    setCustomServiceDesc('');
    setCustomServicePrice('');
    setDownPaymentEnabled(false);
    setDownPaymentAmount(0);
  };

  useEffect(() => { if (isOpen) fetchCustomers(); }, [isOpen]);
  useEffect(() => {
    if (formData.customerId) fetchCustomerBookings(formData.customerId);
    else setBookings([]);
  }, [formData.customerId]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/crm/customers?limit=100');
      const data = await res.json();
      if (data.success) setCustomers(data.customers);
    } catch (err) { console.error('Failed to fetch customers:', err); }
  };

  const fetchCustomerBookings = async (customerId: string) => {
    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;
      const res = await fetch(`/api/bookings?customerPhone=${customer.phone}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.data.filter((b: any) =>
          ['pending', 'in_progress', 'done'].includes(b.status) &&
          ['UNPAID', 'PARTIAL'].includes(b.paymentStatus || 'UNPAID')
        ));
      }
    } catch (err) { console.error('Failed to fetch bookings:', err); }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
  );

  const filteredMotors = useMemo(() => {
    if (!motorSearch) return MOTOR_DATABASE.slice(0, 10);
    const q = motorSearch.toLowerCase();
    return MOTOR_DATABASE.filter(m => m.model.toLowerCase().includes(q)).slice(0, 10);
  }, [motorSearch]);

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => {
      if (item.service.name === 'Spot Repair') return sum + ((item.spotCount || 1) * (item.spotPrice || 100000));
      return sum + (item.manualPrice ?? item.autoPrice);
    }, 0), [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') return Math.round(subtotal * (discountValue / 100));
    return discountValue;
  }, [subtotal, discountType, discountValue]);

  const grandTotal = useManualTotal ? manualTotal : Math.max(0, subtotal - discountAmount);

  // Auto-set kategori saat cart berubah (income only)
  useEffect(() => {
    if (formData.type === 'income' && cart.length > 0 && !formData.category) {
      const firstService = cart[0].service;
      const autoCategory =
        firstService.category === 'repaint' ? 'Repaint' :
          firstService.category === 'detailing' ? 'Detailing' :
            firstService.category === 'coating' ? 'Coating' : '';
      if (autoCategory) setFormData(prev => ({ ...prev, category: autoCategory }));
    }
  }, [cart, formData.type]);

  const handleSelectMotor = (motor: MotorModel) => {
    setSelectedMotor(motor);
    setMotorSearch(motor.model);
    setShowMotorDropdown(false);
    setCart(prev => prev.map(item => ({ ...item, autoPrice: getServicePrice(item.service, motor) })));
  };

  const toggleService = (service: ServiceItem) => {
    const exists = cart.find(i => i.service.name === service.name);
    if (exists) {
      setCart(prev => prev.filter(i => i.service.name !== service.name));
    } else {
      const price = getServicePrice(service, selectedMotor);
      setCart(prev => [...prev, {
        service, autoPrice: price, manualPrice: null,
        ...(service.name === 'Spot Repair' ? { spotCount: 1, spotPrice: 100000 } : {})
      }]);
    }
  };

  const addCustomService = () => {
    if (!customServiceDesc || !customServicePrice) return;
    const price = parseInt(customServicePrice) || 0;
    const fakeService: ServiceItem = { name: customServiceDesc, category: 'custom' as any, pricingType: 'fixed' as any };
    setCart(prev => [...prev, { service: fakeService, autoPrice: price, manualPrice: price }]);
    setCustomServiceDesc('');
    setCustomServicePrice('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi minimal
    if (!formData.category) { alert('Mohon pilih kategori transaksi.'); return; }
    if (!formData.description) { alert('Mohon isi keterangan transaksi.'); return; }
    if (grandTotal <= 0 && formData.type === 'income') { alert('Total transaksi harus lebih dari 0.'); return; }
    if (formData.type === 'expense' && !formData.amount) { alert('Mohon isi nominal pengeluaran.'); return; }

    setLoading(true);
    try {
      const finalServiceType = cart.map(i => i.service.name).join(', ') || formData.serviceType;
      const finalDescription = cart.length > 0
        ? `[CAR] ${formData.description || finalServiceType}`
        : formData.description;

      const finalAmount = formData.type === 'expense'
        ? (parseInt(formData.amount) || 0)
        : grandTotal;

      const url = editData ? `/api/finance/${editData.id}` : '/api/finance';
      const method = editData ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: finalAmount,
          serviceType: finalServiceType,
          description: finalDescription,
          downPayment: downPaymentEnabled ? downPaymentAmount : 0,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      if (!editData) clearDraft();
      onClose();
      setFormData({
        type: 'income', amount: '', category: '', description: '',
        paymentMethod: 'transfer', customerId: '', customerName: '',
        vehicleId: '', plateNumber: '', serviceType: '', bookingId: '',
      });
      setSearchQuery('');
      setBookings([]);
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Gagal menyimpan transaksi');
    } finally {
      setLoading(false);
    }
  };

  const currentCategories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="6xl" showHeader={false}>
      <div className="flex h-[88vh] overflow-hidden rounded-lg">

        {/* ── LEFT COLUMN ── */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#1C1B1B]">
          {/* Header */}
          <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-[#131313]/50 shrink-0">
            <h1 className="font-headline text-2xl font-black tracking-tight uppercase flex items-center gap-3 text-white">
              <span className="material-symbols-outlined text-[#FFFF00]">point_of_sale</span>
              {editData ? 'Edit Transaksi' : 'New Transaction'}
            </h1>
            <div className="flex p-1 bg-[#131313] rounded border border-white/5">
              {(['income', 'expense'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: t, category: '' }))}
                  className={`px-4 py-1.5 rounded font-headline font-bold text-xs uppercase transition-all ${formData.type === t ? 'bg-[#FFFF00] text-[#131313]' : 'text-white/40 hover:text-white'
                    }`}>
                  {t === 'income' ? '↑ Income' : '↓ Expense'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">

            {/* ── KATEGORI & KETERANGAN — selalu di atas ── */}
            <div className="space-y-4">
              <SectionLabel icon="label" text="Informasi Transaksi" />
              <div className="grid grid-cols-2 gap-6">

                {/* Kategori Dropdown */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">
                    Kategori <span className="text-[#FFFF00]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.category}
                      onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      required
                      className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] focus:ring-1 focus:ring-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded appearance-none transition-all"
                    >
                      <option value="" disabled>Pilih kategori...</option>
                      {currentCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">expand_more</span>
                  </div>
                </div>

                {/* Keterangan */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">
                    Keterangan <span className="text-[#FFFF00]">*</span>
                  </label>
                  <input
                    placeholder={formData.type === 'income' ? 'Contoh: Repaint full body NMax Tauhid' : 'Contoh: Beli cat PU 1kg + thinner'}
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                    className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] focus:ring-1 focus:ring-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded placeholder:text-white/20 transition-all"
                  />
                </div>
              </div>

              {/* Payment Method — selalu tampil */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Metode Pembayaran</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'transfer', label: 'Transfer BCA' },
                      { value: 'cash', label: 'Tunai' },
                      { value: 'qris', label: 'QRIS' },
                    ].map(m => (
                      <button key={m.value} type="button"
                        onClick={() => setFormData(prev => ({ ...prev, paymentMethod: m.value }))}
                        className={`flex-1 py-2.5 text-[10px] font-headline font-black uppercase tracking-widest border transition-all ${formData.paymentMethod === m.value
                          ? 'bg-[#FFFF00] text-[#131313] border-[#FFFF00]'
                          : 'bg-[#131313] text-white/40 border-white/5 hover:border-white/20'
                          }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nominal — untuk expense langsung di sini */}
                {formData.type === 'expense' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">
                      Nominal Pengeluaran (IDR) <span className="text-[#FFFF00]">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-white/30 font-headline">Rp</span>
                      <input
                        type="number" placeholder="0"
                        value={formData.amount}
                        onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] focus:ring-1 focus:ring-[#FFFF00] outline-none pl-10 pr-4 py-3 text-sm text-[#ffb4ab] font-bold text-right rounded placeholder:text-white/20 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── CUSTOMER — hanya untuk income ── */}
            {formData.type === 'income' && (
              <>
                <div className="space-y-5">
                  <SectionLabel icon="person" text="Customer Details" />
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Cari Customer (Nama / WA)</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Ketik nama atau nomor WA..."
                          value={searchQuery}
                          onChange={e => { setSearchQuery(e.target.value); setShowCustomerDropdown(true); }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                          className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] focus:ring-1 focus:ring-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded placeholder:text-white/20 transition-all"
                        />
                        <span className="material-symbols-outlined absolute right-3 top-2.5 text-white/30 text-sm">search</span>
                        {showCustomerDropdown && searchQuery && (
                          <div className="absolute z-50 w-full mt-1 bg-[#1C1B1B] border border-white/10 rounded max-h-48 overflow-y-auto shadow-2xl">
                            {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                              <button key={c.id} type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, customerId: c.id, customerName: c.name }));
                                  setSearchQuery(c.name);
                                  setShowCustomerDropdown(false);
                                }}
                                className="w-full px-4 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                                <span className="font-bold text-[13px] text-white">{c.name}</span>
                                <span className="text-white/40 text-[11px] ml-2">{c.phone}</span>
                              </button>
                            )) : (
                              <div className="px-4 py-3 text-[12px] text-white/30">Tidak ditemukan</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Plat Nomor</label>
                      <input
                        placeholder="B 1234 XYZ"
                        value={formData.plateNumber}
                        onChange={e => setFormData(prev => ({ ...prev, plateNumber: e.target.value }))}
                        className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] focus:ring-1 focus:ring-[#FFFF00] outline-none px-4 py-3 text-sm text-white font-headline font-bold tracking-widest uppercase rounded placeholder:font-normal placeholder:text-white/20 transition-all"
                      />
                    </div>
                  </div>

                  {selectedCustomer && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Model Motor</label>
                        <div className="relative">
                          <input
                            value={motorSearch}
                            onChange={e => { setMotorSearch(e.target.value); setShowMotorDropdown(true); }}
                            onFocus={() => setShowMotorDropdown(true)}
                            onBlur={() => setTimeout(() => setShowMotorDropdown(false), 150)}
                            placeholder="NMax, Vario, PCX..."
                            className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] focus:ring-1 focus:ring-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded placeholder:text-white/20 transition-all"
                          />
                          {showMotorDropdown && filteredMotors.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-[#1C1B1B] border border-white/10 rounded max-h-48 overflow-y-auto shadow-2xl">
                              {filteredMotors.map(m => (
                                <button key={m.model} type="button" onClick={() => handleSelectMotor(m)}
                                  className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-white hover:bg-white/5 border-b border-white/5 last:border-0">
                                  {m.model}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedCustomer.vehicles.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Kendaraan Terdaftar</label>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {selectedCustomer.vehicles.map(v => (
                              <button key={v.id} type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, vehicleId: v.id, plateNumber: v.plateNumber || '' }));
                                  setMotorSearch(v.modelName);
                                  const match = MOTOR_DATABASE.find(m =>
                                    m.model.toLowerCase().includes(v.modelName.toLowerCase()) ||
                                    v.modelName.toLowerCase().includes(m.model.toLowerCase())
                                  );
                                  if (match) handleSelectMotor(match); else setSelectedMotor(null);
                                }}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase border transition-all ${formData.vehicleId === v.id
                                  ? 'bg-[#FFFF00]/10 border-[#FFFF00]/40 text-[#FFFF00]'
                                  : 'bg-[#131313] border-white/10 text-white/40 hover:text-white hover:border-white/20'
                                  }`}>
                                {v.modelName}{v.plateNumber ? ` · ${v.plateNumber}` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedCustomer && bookings.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Booking Aktif (Klik untuk link ke booking)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {bookings.map(b => {
                          const remaining = (b.subtotal || 0) - (b.amountPaid || 0);
                          return (
                            <button key={b.id} type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  bookingId: b.id,
                                  serviceType: b.serviceType,
                                  plateNumber: b.plateNumber || '',
                                  description: `Pelunasan: ${b.serviceType}`,
                                  category: 'Repaint',
                                }));
                                setUseManualTotal(true);
                                setManualTotal(remaining);
                              }}
                              className={`flex justify-between items-center px-4 py-3 text-left border transition-all ${formData.bookingId === b.id
                                ? 'bg-[#FFFF00]/8 border-[#FFFF00]/30'
                                : 'bg-[#131313] border-white/5 hover:border-white/15'
                                }`}>
                              <div>
                                <p className="text-[12px] font-bold text-white">{b.serviceType}</p>
                                <p className="text-[10px] text-white/30">{b.plateNumber || '-'} · {b.bookingDate}</p>
                              </div>
                              <span className="text-[11px] font-bold text-[#FFFF00]">{formatRupiah(remaining)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SERVICES ── */}
                <div className="space-y-5">
                  <SectionLabel icon="auto_fix_high" text="Pilih Layanan" />
                  <div className="grid grid-cols-3 gap-4">
                    {SERVICES.map(svc => {
                      const inCart = !!cart.find(i => i.service.name === svc.name);
                      const price = getServicePrice(svc, selectedMotor);
                      return (
                        <button key={svc.name} type="button" onClick={() => toggleService(svc)}
                          className={`p-4 text-left border transition-all ${inCart ? 'bg-[#FFFF00]/10 border-[#FFFF00]/40' : 'bg-[#131313] border-white/5 hover:border-[#FFFF00]/30'
                            }`}>
                          <p className="font-headline font-bold text-xs uppercase mb-3 text-white">{svc.name}</p>
                          <p className={`font-headline font-black text-sm ${inCart ? 'text-[#FFFF00]' : 'text-white/60'}`}>
                            {selectedMotor ? formatRupiah(price) : 'Pilih motor dulu'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── CUSTOM SERVICE ── */}
                <div className="space-y-5">
                  <SectionLabel icon="edit_note" text="Custom / Spot Repair" />
                  <div className="bg-[#131313]/30 p-6 border border-white/5 space-y-4">
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-6 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-white/40 block">Nama Layanan</label>
                        <input value={customServiceDesc} onChange={e => setCustomServiceDesc(e.target.value)}
                          placeholder="Contoh: Poles Kaca Depan"
                          className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] focus:ring-1 focus:ring-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded placeholder:text-white/20 transition-all" />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-white/40 block">Qty</label>
                        <input type="number" defaultValue={1} min={1}
                          className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-3 text-sm text-white text-center rounded transition-all" />
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-white/40 block">Harga (Rp)</label>
                        <input value={customServicePrice} onChange={e => setCustomServicePrice(e.target.value)}
                          type="number" placeholder="0"
                          className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded placeholder:text-white/20 transition-all" />
                      </div>
                      <div className="col-span-1 flex items-end">
                        <button type="button" onClick={addCustomService}
                          className="w-full h-[46px] bg-[#FFFF00] text-[#131313] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all">
                          <span className="material-symbols-outlined font-bold">add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── RIGHT COLUMN — ORDER SUMMARY ── */}
        <section className="w-[380px] shrink-0 bg-[#131313] border-l border-white/5 flex flex-col">
          <div className="p-8 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-headline text-xl font-black uppercase tracking-tighter text-white">
                {formData.type === 'income' ? 'Order Summary' : 'Expense Detail'}
              </h3>
              <span className="material-symbols-outlined text-white/30">receipt_long</span>
            </div>

            {/* Type indicator */}
            <div className={`mb-6 px-4 py-3 border-l-2 text-[10px] font-headline font-bold uppercase tracking-widest ${formData.type === 'income'
              ? 'border-[#FFFF00] bg-[#FFFF00]/5 text-[#FFFF00]'
              : 'border-[#ffb4ab] bg-[#ffb4ab]/5 text-[#ffb4ab]'
              }`}>
              {formData.type === 'income' ? '↑ Pemasukan' : '↓ Pengeluaran'}
              {formData.category && ` · ${formData.category}`}
            </div>

            {/* Cart items (income only) */}
            {formData.type === 'income' && (
              <div className="flex-1 space-y-3 overflow-y-auto mb-6 pr-1 min-h-0 no-scrollbar">
                {cart.length === 0 ? (
                  <p className="text-[12px] text-white/20 italic text-center pt-8">Belum ada layanan dipilih</p>
                ) : cart.map(item => {
                  const isSpot = item.service.name === 'Spot Repair';
                  const itemTotal = isSpot
                    ? (item.spotCount || 1) * (item.spotPrice || 100000)
                    : (item.manualPrice ?? item.autoPrice);
                  return (
                    <div key={item.service.name} className="group bg-[#1C1B1B]/40 p-3 border border-transparent hover:border-white/5">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-headline font-bold text-xs uppercase text-white truncate pr-4">{item.service.name}</span>
                        <button type="button" onClick={() => toggleService(item.service)}
                          className="text-white/20 hover:text-red-400 transition-colors shrink-0">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        {isSpot ? (
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={1} value={item.spotCount || 1}
                              onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotCount: parseInt(e.target.value) || 1 } : i))}
                              className="w-10 bg-[#131313] border-none px-1 py-0.5 text-center text-white text-[10px] focus:ring-0" />
                            <span className="text-[9px] text-white/30">× Rp</span>
                            <input type="number" value={item.spotPrice || 100000}
                              onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotPrice: parseInt(e.target.value) || 0 } : i))}
                              className="w-20 bg-[#131313] border-none px-1 py-0.5 text-right text-[#FFFF00] text-[10px] font-bold focus:ring-0" />
                          </div>
                        ) : (
                          <input type="number" value={item.manualPrice ?? item.autoPrice}
                            onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, manualPrice: parseInt(e.target.value) || 0 } : i))}
                            className="bg-transparent border-none px-0 py-0 text-[10px] text-white/40 focus:ring-0 w-24" />
                        )}
                        <span className="font-headline font-bold text-sm text-white">
                          {itemTotal.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Adjustments (income only) */}
            {formData.type === 'income' && (
              <div className="space-y-5 pt-5 border-t border-white/5">
                {/* Discount */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white/30 text-sm">sell</span>
                    <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Diskon</label>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-[10px] font-bold text-white/30">Rp</span>
                      <input type="number"
                        value={discountType === 'nominal' ? (discountValue || '') : ''}
                        onChange={e => { setDiscountType('nominal'); setDiscountValue(parseInt(e.target.value) || 0); }}
                        placeholder="Nominal"
                        className="w-full bg-[#1C1B1B] border border-white/5 focus:border-[#FFFF00] outline-none pl-8 pr-3 py-2 text-xs text-white rounded placeholder:text-white/20" />
                    </div>
                    <div className="relative w-20">
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-white/30">%</span>
                      <input type="number"
                        value={discountType === 'percentage' ? (discountValue || '') : ''}
                        onChange={e => { setDiscountType('percentage'); setDiscountValue(parseInt(e.target.value) || 0); }}
                        placeholder="%"
                        className="w-full bg-[#1C1B1B] border border-white/5 focus:border-[#FFFF00] outline-none pl-3 pr-7 py-2 text-xs text-white rounded text-center placeholder:text-white/20" />
                    </div>
                  </div>
                </div>

                {/* Down Payment */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-white/30 text-sm">payments</span>
                      <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Down Payment</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={downPaymentEnabled} onChange={e => setDownPaymentEnabled(e.target.checked)} />
                      <div className="w-8 h-4 bg-[#1C1B1B] border border-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#FFFF00]" />
                    </label>
                  </div>
                  {downPaymentEnabled && (
                    <input type="number" value={downPaymentAmount || ''} onChange={e => setDownPaymentAmount(parseInt(e.target.value) || 0)}
                      placeholder="Jumlah DP"
                      className="w-full bg-[#1C1B1B] border border-white/5 focus:border-[#FFFF00] outline-none px-3 py-2.5 text-sm text-[#FFFF00] font-bold rounded placeholder:text-white/20" />
                  )}
                </div>

                {/* Special price override */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={useManualTotal} onChange={e => setUseManualTotal(e.target.checked)} className="size-3 accent-[#FFFF00]" />
                    <span className="text-[10px] font-bold uppercase text-[#FFFF00]/60 tracking-wider">Special Price</span>
                  </label>
                  {useManualTotal && (
                    <input type="number" value={manualTotal || ''} onChange={e => setManualTotal(parseInt(e.target.value) || 0)}
                      className="flex-1 bg-[#1C1B1B] border border-white/5 focus:border-[#FFFF00] outline-none px-3 py-1.5 text-right text-sm text-[#FFFF00] font-bold rounded" />
                  )}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className={`pt-4 space-y-1 ${formData.type === 'income' ? 'border-t border-white/5 mt-4' : 'mt-auto'}`}>
              {formData.type === 'income' && (
                <>
                  <div className="flex justify-between items-center text-white/40">
                    <span className="text-[10px] font-bold uppercase">Subtotal</span>
                    <span className="font-headline font-semibold text-xs">{formatRupiah(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-[#ffb4ab]">
                      <span className="text-[10px] font-bold uppercase">Diskon</span>
                      <span className="font-headline font-semibold text-xs">- {formatRupiah(discountAmount)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between items-end pt-3">
                <span className={`text-xs font-black uppercase leading-none ${formData.type === 'income' ? 'text-[#FFFF00]' : 'text-[#ffb4ab]'}`}>
                  {formData.type === 'income' ? 'Grand Total' : 'Total Pengeluaran'}
                </span>
                <p className={`font-headline font-black text-3xl leading-none tracking-tighter ${formData.type === 'income' ? 'text-[#FFFF00]' : 'text-[#ffb4ab]'}`}>
                  {formData.type === 'income'
                    ? formatRupiah(grandTotal)
                    : formatRupiah(parseInt(formData.amount) || 0)
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-8 pt-0 space-y-3">
            <button type="button" onClick={handleSubmit as any} disabled={loading}
              className={`w-full py-5 font-headline font-black text-lg tracking-widest uppercase transition-all active:scale-[0.98] disabled:opacity-50 ${formData.type === 'income'
                ? 'bg-[#FFFF00] text-[#131313] hover:bg-white'
                : 'bg-[#ffb4ab] text-[#690005] hover:bg-white'
                }`}>
              {loading ? 'MENYIMPAN...' : editData ? 'UPDATE TRANSAKSI' : 'SIMPAN TRANSAKSI'}
            </button>
            <button type="button" onClick={onClose}
              className="w-full py-3 border border-white/5 text-white/40 hover:text-white hover:bg-[#1C1B1B] font-headline font-bold text-[10px] tracking-widest uppercase transition-all">
              BATAL
            </button>
          </div>
        </section>
      </div>
    </BaseModal>
  );
}

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
      <span className="material-symbols-outlined text-[#FFFF00] text-[16px]">{icon}</span>
      <span className="text-[10px] font-headline font-black text-white/60 uppercase tracking-widest">{text}</span>
    </div>
  );
}