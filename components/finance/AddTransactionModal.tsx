'use client';

import React, { useState, useEffect, useMemo } from 'react';
import BaseModal from '@/components/shared/Modal';
import { formatRupiah } from '@/lib/data/pricing';
import { usePricingData, calculateServicePrice, type Service, type VehicleModel } from '@/lib/hooks/usePricingData';
import { Transaction } from '@/lib/hooks/useFinanceData';
import { cn } from '@/lib/utils';

// ─── KATEGORI DROPDOWN ───
const INCOME_CATEGORIES = [
  { value: 'Repaint', label: '🎨 Repaint' },
  { value: 'Detailing', label: '✨ Detailing' },
  { value: 'Coating', label: '🛡️ Coating' },
  { value: 'Cuci Motor', label: '🚿 Cuci Motor' },
  { value: 'Spot Repair', label: '🔧 Spot Repair' },
  { value: 'Lainnya', label: '📦 Lainnya' },
];

const EXPENSE_CATEGORIES = [
  { value: 'Bahan Baku', label: '🪣 Bahan Baku' },
  { value: 'Perlengkapan', label: '🧰 Perlengkapan' },
  { value: 'Gaji', label: '💵 Gaji & Upah' },
  { value: 'Sewa & Operasional', label: '🏢 Sewa & Operasional' },
  { value: 'Listrik & Air', label: '⚡ Listrik & Air' },
  { value: 'Marketing', label: '📢 Marketing' },
  { value: 'Lainnya', label: '📦 Lainnya' },
];

interface Customer {
  id: string;
  name: string;
  phone: string;
  vehicles: { id: string; modelName: string; plateNumber: string | null }[];
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
  service: Service;
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
  const { services, vehicleModels, surcharges, loading: loadingPricing } = usePricingData();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [selectedMotor, setSelectedMotor] = useState<VehicleModel | null>(null);
  const [motorSearch, setMotorSearch] = useState('');
  const [showMotorDropdown, setShowMotorDropdown] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [discountValue, setDiscountValue] = useState(0);
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [manualTotal, setManualTotal] = useState(0);
  const [customServiceDesc, setCustomServiceDesc] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');

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

  // Load Edit or Draft
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          type: editData.type as 'income' | 'expense',
          amount: editData.amount.toString(),
          category: editData.category || '',
          description: (editData.description || '').replace(/^\[CAR\]\s*/, ''),
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
            setMotorSearch(draft.motorSearch || '');
            setSearchQuery(draft.customerName || '');
          } catch (e) { console.error('Failed to load draft', e); }
        }
      }
    }
  }, [isOpen, editData]);

  // Save Draft
  useEffect(() => {
    if (isOpen && formData.customerId && !editData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formData, cart, discountType, discountValue, useManualTotal,
        manualTotal, motorSearch, customerName: searchQuery
      }));
    }
  }, [formData, cart, discountType, discountValue, useManualTotal, manualTotal, motorSearch, isOpen, editData, searchQuery]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCart([]);
    setDiscountValue(0);
    setUseManualTotal(false);
    setManualTotal(0);
    setSelectedMotor(null);
    setMotorSearch('');
  };

  useEffect(() => { if (isOpen) fetchCustomers(); }, [isOpen]);
  useEffect(() => {
    if (formData.customerId) fetchCustomerBookings(formData.customerId);
    else setBookings([]);
  }, [formData.customerId, customers]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/crm/customers?limit=1000');
      const data = await res.json();
      if (data.success) setCustomers(data.customers);
    } catch (err) { console.error('Failed to fetch customers:', err); }
  };

  const fetchCustomerBookings = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    try {
      const res = await fetch(`/api/bookings?customerPhone=${customer.phone}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.data.filter((b: any) =>
          ['pending', 'in_progress', 'done'].includes(b.status.toLowerCase()) &&
          ['UNPAID', 'PARTIAL'].includes(b.paymentStatus || 'UNPAID')
        ));
      }
    } catch (err) { console.error('Failed to fetch bookings:', err); }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
  );

  const filteredMotors = useMemo(() => {
    if (!motorSearch) return vehicleModels.slice(0, 10);
    const q = motorSearch.toLowerCase();
    return vehicleModels.filter(m => 
      m.modelName.toLowerCase().includes(q) || 
      m.aliases.some(a => a.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [motorSearch, vehicleModels]);

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

  // Auto-set category from cart
  useEffect(() => {
    if (formData.type === 'income' && cart.length > 0 && !formData.category) {
      const cat = cart[0].service.category;
      const mapped = cat.charAt(0).toUpperCase() + cat.slice(1);
      setFormData(prev => ({ ...prev, category: mapped }));
    }
  }, [cart, formData.type, formData.category]);

  const handleSelectMotor = (motor: VehicleModel) => {
    setSelectedMotor(motor);
    setMotorSearch(motor.modelName);
    setShowMotorDropdown(false);
    setCart(prev => prev.map(item => ({ ...item, autoPrice: calculateServicePrice(item.service, motor, surcharges) })));
  };

  const toggleService = (service: Service) => {
    const exists = cart.find(i => i.service.name === service.name);
    if (exists) {
      setCart(prev => prev.filter(i => i.service.name !== service.name));
    } else {
      const price = calculateServicePrice(service, selectedMotor, surcharges);
      setCart(prev => [...prev, {
        service, autoPrice: price, manualPrice: null,
        ...(service.name === 'Spot Repair' ? { spotCount: 1, spotPrice: 100000 } : {})
      }]);
    }
  };

  const addCustomService = () => {
    if (!customServiceDesc || !customServicePrice) return;
    const price = parseInt(customServicePrice) || 0;
    const fakeService: Service = { 
      id: 'custom-' + Date.now(), name: customServiceDesc, category: 'custom', subcategory: null,
      summary: null, description: null, estimatedDuration: 0, usesModelPricing: false, prices: []
    };
    setCart(prev => [...prev, { service: fakeService, autoPrice: price, manualPrice: price }]);
    setCustomServiceDesc(''); setCustomServicePrice('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) return alert('Pilih kategori!');
    if (formData.type === 'expense' && !formData.amount) return alert('Isi nominal!');
    
    setLoading(true);
    try {
      const finalServiceType = cart.map(i => i.service.name).join(', ') || formData.serviceType;
      const finalDesc = cart.length > 0 ? `[CAR] ${formData.description || finalServiceType}` : formData.description;
      const finalAmount = formData.type === 'expense' ? (parseInt(formData.amount) || 0) : grandTotal;

      const res = await fetch(editData ? `/api/finance/${editData.id}` : '/api/finance', {
        method: editData ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, amount: finalAmount, serviceType: finalServiceType, description: finalDesc }),
      });

      if (!(await res.json()).success) throw new Error('Gagal simpan');
      if (!editData) clearDraft();
      onClose();
    } catch (err) { alert('Terjadi kesalahan'); } finally { setLoading(false); }
  };

  const currentCategories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="6xl" showHeader={false}>
      <div className="flex h-[88vh] overflow-hidden">
        
        {/* LEFT COLUMN */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#1C1B1B]">
          <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-[#131313]/50 shrink-0">
            <h1 className="font-headline text-2xl font-black tracking-tight uppercase flex items-center gap-3 text-white">
              <span className="material-symbols-outlined text-[#FFFF00]">point_of_sale</span>
              {editData ? 'Edit Transaksi' : 'New Transaction'}
            </h1>
            <div className="flex p-1 bg-[#131313] rounded border border-white/5">
              {(['income', 'expense'] as const).map(t => (
                <button key={t} type="button" onClick={() => setFormData(prev => ({ ...prev, type: t, category: '' }))}
                  className={`px-4 py-1.5 rounded font-headline font-bold text-xs uppercase transition-all ${formData.type === t ? 'bg-[#FFFF00] text-[#131313]' : 'text-white/40 hover:text-white'}`}>
                  {t === 'income' ? '↑ Income' : '↓ Expense'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
            {/* COMMON FIELDS: CATEGORY & DESC */}
            <div className="space-y-4">
              <SectionLabel icon="label" text="Transaction Info" />
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Kategori *</label>
                  <select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded appearance-none">
                    <option value="" disabled>Pilih kategori...</option>
                    {currentCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Keterangan *</label>
                  <input placeholder="Detail singkat..." value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Metode Pembayaran</label>
                  <div className="flex gap-2">
                    {['transfer', 'cash', 'qris'].map(m => (
                      <button key={m} type="button" onClick={() => setFormData(p => ({ ...p, paymentMethod: m }))}
                        className={`flex-1 py-2.5 text-[10px] font-headline font-black uppercase tracking-widest border transition-all ${formData.paymentMethod === m ? 'bg-[#FFFF00] text-[#131313] border-[#FFFF00]' : 'bg-[#131313] text-white/40 border-white/5 hover:border-white/20'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {formData.type === 'expense' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Nominal (IDR) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-bold">Rp</span>
                      <input type="number" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                        className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none pl-10 pr-4 py-3 text-[#ffb4ab] font-bold text-right text-sm rounded" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* INCOME-SPECIFIC: CUSTOMER & SERVICES */}
            {formData.type === 'income' && (
              <>
                <div className="space-y-5">
                  <SectionLabel icon="person" text="Customer Details" />
                  <div className="grid grid-cols-2 gap-6">
                    <div className="relative space-y-2">
                      <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Cari Customer</label>
                      <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setShowCustomerDropdown(true); }}
                        onFocus={() => setShowCustomerDropdown(true)} onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                        placeholder="Nama / WhatsApp..." className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded" />
                      {showCustomerDropdown && searchQuery && (
                        <div className="absolute z-50 w-full mt-1 bg-[#1C1B1B] border border-white/10 rounded max-h-48 overflow-y-auto shadow-2xl">
                          {filteredCustomers.map(c => (
                            <button key={c.id} type="button" onClick={() => { setFormData(p => ({ ...p, customerId: c.id, customerName: c.name })); setSearchQuery(c.name); setShowCustomerDropdown(false); }}
                              className="w-full px-4 py-2.5 text-left hover:bg-white/5 text-white border-b border-white/5 last:border-0">
                              <span className="font-bold text-sm">{c.name}</span>
                              <span className="text-white/40 text-xs ml-2">{c.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Plat Nomor</label>
                      <input value={formData.plateNumber} onChange={e => setFormData(p => ({ ...p, plateNumber: e.target.value }))}
                        placeholder="B 1234 XYZ" className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded uppercase font-bold" />
                    </div>
                  </div>

                  {selectedCustomer && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="relative space-y-2">
                        <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Model Motor</label>
                        <input value={motorSearch} onChange={e => { setMotorSearch(e.target.value); setShowMotorDropdown(true); }}
                          onFocus={() => setShowMotorDropdown(true)} onBlur={() => setTimeout(() => setShowMotorDropdown(false), 150)}
                          placeholder="Cari model..." className="w-full bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-3 text-sm text-white rounded" />
                        {showMotorDropdown && filteredMotors.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-[#1C1B1B] border border-white/10 rounded max-h-48 overflow-y-auto shadow-2xl">
                            {filteredMotors.map(m => (
                              <button key={m.id} type="button" onClick={() => handleSelectMotor(m)}
                                className="w-full px-4 py-2.5 text-left hover:bg-white/5 text-white border-b border-white/5 last:border-0 text-sm">
                                {m.modelName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase text-white/50 tracking-wider block">Kendaraan Terdaftar</label>
                        <div className="flex flex-wrap gap-2">
                          {selectedCustomer.vehicles.map(v => (
                            <button key={v.id} type="button" onClick={() => { 
                              setFormData(p => ({ ...p, vehicleId: v.id, plateNumber: v.plateNumber || '' }));
                              setMotorSearch(v.modelName);
                              const match = vehicleModels.find(m => m.modelName.toLowerCase() === v.modelName.toLowerCase());
                              if (match) handleSelectMotor(match); else setSelectedMotor(null);
                            }}
                              className={`px-3 py-1.5 text-[10px] font-bold uppercase border transition-all ${formData.vehicleId === v.id ? 'bg-[#FFFF00]/10 border-[#FFFF00]/40 text-[#FFFF00]' : 'bg-[#131313] border-white/10 text-white/40 hover:text-white'}`}>
                              {v.modelName}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-5">
                  <SectionLabel icon="auto_fix_high" text="Service Selection" />
                  <div className="grid grid-cols-3 gap-3">
                    {services.filter(s => s.category !== 'custom').map(svc => {
                      const selected = !!cart.find(i => i.service.name === svc.name);
                      const price = calculateServicePrice(svc, selectedMotor, surcharges);
                      return (
                        <button key={svc.id} type="button" onClick={() => toggleService(svc)}
                          className={`p-3 text-left border rounded transition-all ${selected ? 'bg-[#FFFF00]/10 border-[#FFFF00]/40' : 'bg-[#131313] border-white/5 hover:border-white/20'}`}>
                          <p className="text-[10px] font-bold uppercase text-white truncate">{svc.name}</p>
                          <p className={`text-xs font-black mt-1 ${selected ? 'text-[#FFFF00]' : 'text-white/40'}`}>
                            {selectedMotor ? formatRupiah(price) : '—'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-5">
                  <SectionLabel icon="edit_note" text="Custom Service" />
                  <div className="flex gap-2">
                    <input value={customServiceDesc} onChange={e => setCustomServiceDesc(e.target.value)} placeholder="Nama layanan..."
                      className="flex-1 bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-2.5 text-sm text-white rounded" />
                    <input value={customServicePrice} onChange={e => setCustomServicePrice(e.target.value)} type="number" placeholder="Harga"
                      className="w-32 bg-[#131313] border border-white/5 focus:border-[#FFFF00] outline-none px-4 py-2.5 text-sm text-white rounded" />
                    <button type="button" onClick={addCustomService} className="bg-[#FFFF00] text-[#131313] px-4 rounded font-bold hover:opacity-90">+</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <section className="w-[360px] shrink-0 bg-[#131313] border-l border-white/5 flex flex-col">
          <div className="p-8 flex-1 flex flex-col overflow-hidden">
            <h3 className="font-headline text-xl font-black uppercase text-white mb-8">Summary</h3>
            
            {formData.type === 'income' && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar mb-6">
                {cart.length === 0 ? <p className="text-white/20 italic text-center">Belum ada item</p> : cart.map(item => (
                  <div key={item.service.id} className="bg-[#1C1B1B]/40 p-3 border border-white/5">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-white uppercase truncate">{item.service.name}</span>
                      <button type="button" onClick={() => toggleService(item.service)} className="text-white/20 hover:text-red-400">✕</button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <input type="number" value={item.manualPrice ?? item.autoPrice} onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setCart(p => p.map(i => i.service.id === item.service.id ? { ...i, manualPrice: val } : i));
                      }} className="bg-transparent border-none p-0 text-[10px] text-white/40 w-20 focus:ring-0" />
                      <span className="text-xs font-bold text-white">{(item.manualPrice ?? item.autoPrice).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-auto space-y-4 pt-6 border-t border-white/5">
              {formData.type === 'income' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase">Discount</label>
                    <div className="flex gap-2">
                      <input type="number" value={discountValue || ''} onChange={e => setDiscountValue(parseInt(e.target.value) || 0)}
                        placeholder="0" className="flex-1 bg-[#1C1B1B] border border-white/5 px-3 py-2 text-xs text-white rounded" />
                      <select value={discountType} onChange={e => setDiscountType(e.target.value as any)}
                        className="bg-[#1C1B1B] border border-white/5 text-[10px] text-white/60 px-2 rounded">
                        <option value="nominal">IDR</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-between text-white/40">
                    <span className="text-[10px] font-bold uppercase">Subtotal</span>
                    <span className="text-xs">{formatRupiah(subtotal)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-end pt-2">
                <span className={`text-xs font-black uppercase ${formData.type === 'income' ? 'text-[#FFFF00]' : 'text-[#ffb4ab]'}`}>
                  {formData.type === 'income' ? 'Grand Total' : 'Total Expense'}
                </span>
                <span className={`font-headline font-black text-3xl ${formData.type === 'income' ? 'text-[#FFFF00]' : 'text-[#ffb4ab]'}`}>
                  {formatRupiah(formData.type === 'expense' ? (parseInt(formData.amount) || 0) : grandTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-8 pt-0 space-y-3">
            <button type="button" onClick={handleSubmit} disabled={loading}
              className={`w-full py-5 font-headline font-black text-base uppercase tracking-widest transition-all ${formData.type === 'income' ? 'bg-[#FFFF00] text-[#131313]' : 'bg-[#ffb4ab] text-[#690005]'} disabled:opacity-50`}>
              {loading ? 'WAIT...' : 'SIMPAN'}
            </button>
            <button type="button" onClick={onClose} className="w-full py-3 border border-white/5 text-white/40 text-[10px] font-bold uppercase tracking-widest">BATAL</button>
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
