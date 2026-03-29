'use client';

import React, { useState, useEffect, useMemo } from 'react';
import BaseModal from '@/components/shared/Modal';
import Input from '@/components/shared/Input';
import {
  MOTOR_DATABASE, SERVICES,
  getServicePrice, formatRupiah,
  type MotorModel, type ServiceItem
} from '@/lib/data/pricing';
import { Transaction } from '@/lib/hooks/useFinanceData';

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
    type: 'income',
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

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          type: editData.type,
          amount: editData.amount.toString(),
          category: editData.category || '',
          description: editData.description || '',
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
        formData, cart, discountType, discountValue, useManualTotal, manualTotal, selectedMotor, motorSearch, customerName: searchQuery
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

  useEffect(() => {
    if (isOpen) fetchCustomers();
  }, [isOpen]);

  useEffect(() => {
    if (formData.customerId) {
      fetchCustomerBookings(formData.customerId);
    } else {
      setBookings([]);
    }
  }, [formData.customerId]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/crm/customers?limit=100');
      const data = await res.json();
      if (data.success) setCustomers(data.customers);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const fetchCustomerBookings = async (customerId: string) => {
    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;
      const res = await fetch(`/api/bookings?customerPhone=${customer.phone}&limit=20`);
      const data = await res.json();
      if (data.success) {
        const activeBookings = data.data.filter((b: any) =>
          ['pending', 'in_progress', 'done'].includes(b.status) &&
          ['UNPAID', 'PARTIAL'].includes(b.paymentStatus || 'UNPAID')
        );
        setBookings(activeBookings);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const filteredMotors = useMemo(() => {
    if (!motorSearch) return MOTOR_DATABASE.slice(0, 10);
    const q = motorSearch.toLowerCase();
    return MOTOR_DATABASE.filter(m => m.model.toLowerCase().includes(q)).slice(0, 10);
  }, [motorSearch]);

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => {
      if (item.service.name === 'Spot Repair') {
        return sum + ((item.spotCount || 1) * (item.spotPrice || 100000));
      }
      return sum + (item.manualPrice ?? item.autoPrice);
    }, 0),
    [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') return Math.round(subtotal * (discountValue / 100));
    return discountValue;
  }, [subtotal, discountType, discountValue]);

  const grandTotal = useManualTotal ? manualTotal : Math.max(0, subtotal - discountAmount);

  const handleSelectMotor = (motor: MotorModel) => {
    setSelectedMotor(motor);
    setMotorSearch(motor.model);
    setShowMotorDropdown(false);
    setCart(prev => prev.map(item => ({
      ...item,
      autoPrice: getServicePrice(item.service, motor),
    })));
  };

  const toggleService = (service: ServiceItem) => {
    const exists = cart.find(i => i.service.name === service.name);
    if (exists) {
      setCart(prev => prev.filter(i => i.service.name !== service.name));
    } else {
      const price = getServicePrice(service, selectedMotor);
      const newItem: CartItem = {
        service,
        autoPrice: price,
        manualPrice: null,
        ...(service.name === 'Spot Repair' ? { spotCount: 1, spotPrice: 100000 } : {})
      };
      setCart(prev => [...prev, newItem]);
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
    setLoading(true);
    try {
      const finalServiceType = cart.map(i => i.service.name).join(', ') || formData.serviceType;
      const isNewCart = cart.length > 0;
      const finalDescription = isNewCart ? `[CAR] ${formData.description || finalServiceType}` : formData.description;

      const url = editData ? `/api/finance/${editData.id}` : '/api/finance';
      const method = editData ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: grandTotal,
          serviceType: finalServiceType,
          description: finalDescription,
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
      console.error('Error adding transaction:', error);
      alert('Gagal menambah transaksi');
    } finally {
      setLoading(false);
    }
  };

  const PAYMENT_METHODS = [
    { value: 'transfer', label: 'Transfer Bank (BCA)' },
    { value: 'cash', label: 'Cash' },
    { value: 'qris', label: 'QRIS' },
  ];

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="4xl" showHeader={false}>
      <div className="flex h-[85vh]">

        {/* LEFT COLUMN */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-[#131313] p-8 space-y-6 min-w-0">

          {/* Title */}
          <div className="flex items-end gap-4">
            <h1 className="font-headline text-4xl font-black tracking-tighter uppercase leading-none text-white">
              {editData ? 'Edit Transaksi' : 'New Transaction'}
            </h1>
            <div className="h-px flex-1 bg-[#eaea00]/20 mb-1" />
          </div>

          {/* Type toggle */}
          <div className="flex gap-px bg-[#0e0e0e] p-px w-fit">
            {(['income', 'expense'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setFormData({ ...formData, type: t })}
                className={`px-6 py-2 text-[11px] font-headline font-black uppercase tracking-widest transition-all ${
                  formData.type === t ? 'bg-[#FFFF00] text-[#131313]' : 'text-white/30 hover:text-white'
                }`}>
                {t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Customer Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#eaea00] text-[20px]">person</span>
                <h3 className="font-headline text-base font-bold tracking-tight uppercase text-white">Customer Info</h3>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase text-white/40 mb-1 ml-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="Cari nama atau nomor HP..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setShowCustomerDropdown(true); }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
                  />
                  {showCustomerDropdown && searchQuery && (
                    <div className="absolute z-50 w-full bg-[#1c1b1b] border border-white/10 max-h-48 overflow-y-auto shadow-2xl">
                      {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setFormData({ ...formData, customerId: c.id, customerName: c.name }); setSearchQuery(c.name); setShowCustomerDropdown(false); }}
                          className="w-full px-4 py-2.5 text-left hover:bg-[#353534] border-b border-white/5 last:border-0">
                          <span className="font-bold text-[12px] text-white">{c.name}</span>
                          <span className="text-white/40 text-[10px] ml-2">{c.phone}</span>
                        </button>
                      )) : <div className="px-4 py-2 text-[11px] text-white/30">Tidak ditemukan</div>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-white/40 mb-1 ml-1">Model Motor</label>
                  <div className="relative">
                    <input
                      value={motorSearch}
                      onChange={e => { setMotorSearch(e.target.value); setShowMotorDropdown(true); }}
                      onFocus={() => setShowMotorDropdown(true)}
                      onBlur={() => setTimeout(() => setShowMotorDropdown(false), 150)}
                      placeholder="NMax, Vario, PCX..."
                      className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
                    />
                    {showMotorDropdown && filteredMotors.length > 0 && (
                      <div className="absolute z-50 w-full bg-[#1c1b1b] border border-white/10 max-h-48 overflow-y-auto shadow-2xl">
                        {filteredMotors.map(m => (
                          <button key={m.model} type="button" onClick={() => handleSelectMotor(m)}
                            className="w-full px-4 py-2.5 text-left text-[12px] font-bold text-white hover:bg-[#353534] border-b border-white/5 last:border-0">
                            {m.model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-white/40 mb-1 ml-1">Plate Number</label>
                  <input
                    placeholder="B 1234 XYZ"
                    value={formData.plateNumber}
                    onChange={e => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white font-headline font-bold border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
                  />
                </div>

                {/* Registered vehicles */}
                {selectedCustomer && selectedCustomer.vehicles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCustomer.vehicles.map(v => (
                      <button key={v.id} type="button"
                        onClick={() => {
                          setFormData({ ...formData, vehicleId: v.id, plateNumber: v.plateNumber || '' });
                          setMotorSearch(v.modelName);
                          const match = MOTOR_DATABASE.find(m => m.model.toLowerCase().includes(v.modelName.toLowerCase()) || v.modelName.toLowerCase().includes(m.model.toLowerCase()));
                          if (match) handleSelectMotor(match); else setSelectedMotor(null);
                        }}
                        className={`px-3 py-1 text-[9px] font-headline font-black uppercase tracking-wider border-l-2 transition-all bg-[#0e0e0e] ${
                          formData.vehicleId === v.id ? 'border-[#eaea00] text-[#eaea00]' : 'border-transparent text-white/30 hover:text-white hover:border-white/20'
                        }`}>
                        {v.modelName}{v.plateNumber ? ` · ${v.plateNumber}` : ''}
                      </button>
                    ))}
                  </div>
                )}

                {/* Active bookings */}
                {selectedCustomer && bookings.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase text-white/40 ml-1">Booking Aktif</label>
                    {bookings.map(b => {
                      const remaining = (b.subtotal || 0) - (b.amountPaid || 0);
                      return (
                        <button key={b.id} type="button"
                          onClick={() => { setFormData({ ...formData, bookingId: b.id, serviceType: b.serviceType, plateNumber: b.plateNumber || '', description: `Pembayaran Sisa Booking untuk ${b.serviceType}`, category: 'Repaint' }); setUseManualTotal(true); setManualTotal(remaining); }}
                          className={`w-full flex justify-between items-center p-3 text-left border-l-2 transition-all bg-[#0e0e0e] ${
                            formData.bookingId === b.id ? 'border-[#eaea00]' : 'border-transparent hover:border-white/20'
                          }`}>
                          <div>
                            <p className="text-[11px] font-bold text-white">{b.serviceType}</p>
                            <p className="text-[9px] text-white/30">{b.plateNumber || 'Tanpa Plat'} · {b.bookingDate}</p>
                          </div>
                          <span className="text-[10px] font-bold text-[#eaea00]">Sisa: {formatRupiah(remaining)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Service Selection */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#eaea00] text-[20px]">auto_fix_high</span>
                <h3 className="font-headline text-base font-bold tracking-tight uppercase text-white">Service Selection</h3>
              </div>
              <div className="space-y-px">
                {SERVICES.map(svc => {
                  const inCart = !!cart.find(i => i.service.name === svc.name);
                  const price = getServicePrice(svc, selectedMotor);
                  return (
                    <button key={svc.name} type="button" onClick={() => toggleService(svc)}
                      className={`w-full flex justify-between items-center px-4 py-3 border-l-2 transition-colors ${
                        inCart
                          ? 'bg-[#2a2a2a] border-[#eaea00]'
                          : 'bg-[#1c1b1b] border-transparent hover:bg-[#2a2a2a] hover:border-[#eaea00]/50'
                      }`}>
                      <div className="text-left">
                        <p className="font-bold text-sm uppercase text-white">{svc.name}</p>
                      </div>
                      <span className={`font-headline font-black text-sm ${inCart ? 'text-[#eaea00]' : 'text-white/60'}`}>
                        {selectedMotor ? formatRupiah(price) : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Custom Service + Discounts */}
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#eaea00] text-[20px]">edit_note</span>
                <h3 className="font-headline text-base font-bold tracking-tight uppercase text-white">Custom Service</h3>
              </div>
              <div className="flex gap-2">
                <input
                  value={customServiceDesc}
                  onChange={e => setCustomServiceDesc(e.target.value)}
                  placeholder="Service Description"
                  className="flex-1 bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
                />
                <input
                  value={customServicePrice}
                  onChange={e => setCustomServicePrice(e.target.value)}
                  type="number"
                  placeholder="Price"
                  className="w-32 bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
                />
                <button type="button" onClick={addCustomService}
                  className="bg-[#eaea00] text-[#131313] px-4 hover:opacity-90 active:scale-95 transition-all">
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            <div className="col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#eaea00] text-[20px]">sell</span>
                <h3 className="font-headline text-base font-bold tracking-tight uppercase text-white">Discounts</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute right-3 top-4 text-[10px] font-bold text-white/40">%</span>
                  <input
                    type="number"
                    value={discountType === 'percentage' ? (discountValue || '') : ''}
                    onChange={e => { setDiscountType('percentage'); setDiscountValue(parseInt(e.target.value) || 0); }}
                    placeholder="Rate"
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-4 text-[10px] font-bold text-white/40">Rp</span>
                  <input
                    type="number"
                    value={discountType === 'nominal' ? (discountValue || '') : ''}
                    onChange={e => { setDiscountType('nominal'); setDiscountValue(parseInt(e.target.value) || 0); }}
                    placeholder="Fixed"
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 pl-8 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-white/40 mb-1 ml-1">Kategori</label>
              <input
                placeholder="Repaint, Gaji, Listrik..."
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-white/40 mb-1 ml-1">Keterangan</label>
              <input
                placeholder="Detail transaksi..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                required
                className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
              />
            </div>
          </div>

          {formData.type === 'expense' && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-white/40 mb-1 ml-1">Nominal (IDR)</label>
              <input
                type="number"
                placeholder="500000"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                className="w-full bg-[#0e0e0e] border-none focus:ring-0 p-4 text-white border-l-2 border-transparent focus:border-[#eaea00] transition-all placeholder:text-[#353534]"
              />
            </div>
          )}
        </form>

        {/* RIGHT COLUMN — ORDER SUMMARY */}
        <section className="w-[340px] shrink-0 bg-[#2a2a2a] flex flex-col shadow-[0px_24px_48px_rgba(0,0,0,0.4)]">
          <div className="flex-1 overflow-y-auto p-8 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-headline text-xl font-black tracking-tight uppercase text-white">Order Summary</h3>
              <span className="material-symbols-outlined text-[#eaea00]">receipt_long</span>
            </div>

            {/* Cart items */}
            <div className="flex-1 space-y-4 mb-8 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <p className="text-[11px] text-white/20 italic text-center pt-12">Belum ada layanan dipilih</p>
              ) : (
                cart.map(item => {
                  const isSpot = item.service.name === 'Spot Repair';
                  const itemTotal = isSpot
                    ? (item.spotCount || 1) * (item.spotPrice || 100000)
                    : (item.manualPrice ?? item.autoPrice);
                  return (
                    <div key={item.service.name} className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-sm uppercase text-white">{item.service.name}</p>
                        {isSpot ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input type="number" min={1} value={item.spotCount || 1}
                              onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotCount: parseInt(e.target.value) || 1 } : i))}
                              className="w-10 bg-[#131313] border-none px-1.5 py-0.5 text-center text-white text-[10px] focus:ring-0"
                            />
                            <span className="text-[9px] text-white/30">spot x</span>
                            <input type="number" value={item.spotPrice || 100000}
                              onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotPrice: parseInt(e.target.value) || 0 } : i))}
                              className="w-24 bg-[#131313] border-none px-1.5 py-0.5 text-right text-[#eaea00] text-[10px] font-bold focus:ring-0"
                            />
                          </div>
                        ) : (
                          <input type="number" value={item.manualPrice ?? item.autoPrice}
                            onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, manualPrice: parseInt(e.target.value) || 0 } : i))}
                            className="mt-0.5 w-full bg-[#131313] border-none px-0 py-0.5 text-left text-[#eaea00]/60 text-[10px] font-bold focus:ring-0 focus:text-[#eaea00]"
                          />
                        )}
                        <p className="text-[10px] text-white/40">Manual Entry</p>
                      </div>
                      <div className="flex items-start gap-2 ml-4 shrink-0">
                        <span className="font-headline font-bold text-sm text-white">
                          {(itemTotal / 1000).toLocaleString('id-ID')}.000
                        </span>
                        <button type="button" onClick={() => toggleService(item.service)}
                          className="text-white/20 hover:text-[#ffb4ab] text-[12px] transition-colors leading-none mt-0.5">x</button>
                      </div>
                    </div>
                  );
                })
              )}

              {discountAmount > 0 && (
                <div className="border-t border-[#353534] pt-4 flex justify-between items-start text-[#eaea00]">
                  <div>
                    <p className="font-bold text-sm uppercase">
                      {discountType === 'percentage' ? 'Promo Discount' : 'Discount'}
                    </p>
                    <p className="text-[10px] opacity-70">
                      {discountType === 'percentage' ? `${discountValue}% OFF` : 'Fixed'}
                    </p>
                  </div>
                  <span className="font-headline font-bold text-sm">- {(discountAmount / 1000).toLocaleString('id-ID')}.000</span>
                </div>
              )}
            </div>

            {/* Payment details */}
            <div className="space-y-6 pt-6 border-t border-[#eaea00]/20">
              {/* Down Payment */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-white/40 tracking-widest">Down Payment</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={downPaymentEnabled}
                    onChange={e => setDownPaymentEnabled(e.target.checked)} />
                  <div className="w-10 h-5 bg-[#353534] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#eaea00]" />
                </label>
              </div>
              {downPaymentEnabled && (
                <input type="number" value={downPaymentAmount || ''} onChange={e => setDownPaymentAmount(parseInt(e.target.value) || 0)}
                  placeholder="Jumlah DP"
                  className="w-full bg-[#131313] border-none focus:ring-0 p-3 text-[#eaea00] font-bold text-right placeholder:text-white/20 border-l-2 border-[#eaea00]/40"
                />
              )}

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-white/40">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full bg-[#131313] border-none p-4 text-white focus:ring-1 focus:ring-[#eaea00] transition-all text-xs font-bold uppercase"
                >
                  <option value="transfer">Transfer Bank (BCA)</option>
                  <option value="cash">Cash / Tunai</option>
                  <option value="qris">QRIS</option>
                </select>
              </div>

              {/* Special Price */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useManualTotal} onChange={e => setUseManualTotal(e.target.checked)}
                    className="size-3 accent-[#eaea00]" />
                  <span className="text-[10px] font-bold uppercase text-[#eaea00]/70 tracking-widest">Special Price</span>
                </label>
                {useManualTotal && (
                  <input type="number" value={manualTotal || ''} onChange={e => setManualTotal(parseInt(e.target.value) || 0)}
                    className="flex-1 bg-[#131313] border-none focus:ring-0 p-2 text-right text-[#eaea00] font-bold text-sm" />
                )}
              </div>

              {/* Totals */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-white/40">
                  <span className="text-[10px] font-bold uppercase">Subtotal</span>
                  <span className="font-headline font-medium text-xs">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-xs font-black uppercase text-[#eaea00] leading-none">Total Amount</span>
                  <span className="font-headline font-black text-3xl text-[#eaea00] leading-none">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-8 pt-0 space-y-3">
            <button type="submit" onClick={handleSubmit as any} disabled={loading}
              className="w-full py-5 bg-[#eaea00] text-[#131313] font-headline font-black text-base tracking-widest uppercase hover:bg-white active:scale-95 transition-all disabled:opacity-50">
              {loading ? 'MENYIMPAN...' : 'SIMPAN TRANSAKSI'}
            </button>
            <button type="button" onClick={onClose}
              className="w-full py-3 border border-[#484831] text-white/40 font-headline font-bold text-xs tracking-widest uppercase hover:bg-[#353534] transition-all">
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
    <div className="flex items-center gap-2 pb-1 border-b border-white/5">
      <span className="material-symbols-outlined text-[#eaea00] text-[14px]">{icon}</span>
      <span className="text-[10px] font-headline font-black text-white/60 uppercase tracking-widest">{text}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-headline font-black text-white/30 uppercase tracking-widest mb-1">{children}</p>
  );
}
