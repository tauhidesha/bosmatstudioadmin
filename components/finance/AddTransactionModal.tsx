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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      showHeader={false}
    >
      {/* Custom full-width layout inside modal */}
      <div className="flex flex-row gap-0 h-[85vh]">

        {/* ── LEFT PANEL ─────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col bg-[#131313] p-6 gap-5 overflow-y-auto min-w-0">

          {/* Modal Title + Type Toggle */}
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-black text-white uppercase tracking-widest text-sm italic">
              {editData ? 'EDIT TRANSAKSI' : 'NEW TRANSACTION'}
            </h2>
            <div className="flex gap-px bg-[#0e0e0e] p-px">
              {(['income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: t })}
                  className={`px-4 py-1.5 text-[10px] font-headline font-black uppercase tracking-widest transition-all ${formData.type === t ? 'bg-[#FFFF00] text-[#131313]' : 'text-white/30 hover:text-white'
                    }`}
                >
                  {t === 'income' ? 'PEMASUKAN' : 'PENGELUARAN'}
                </button>
              ))}
            </div>
          </div>

          {/* ── CUSTOMER INFO ── */}
          <div>
            <SectionLabel icon="person" text="CUSTOMER INFO" />
            <div className="grid grid-cols-1 gap-3 mt-3">
              {/* Customer Search */}
              <div className="relative">
                <FieldLabel>Full Name</FieldLabel>
                <input
                  type="text"
                  placeholder="Cari nama atau nomor HP..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none transition-all placeholder:text-white/20"
                />
                {showCustomerDropdown && searchQuery && (
                  <div className="absolute z-30 w-full mt-0.5 bg-[#1c1b1b] border border-white/10 max-h-40 overflow-y-auto shadow-2xl">
                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => {
                          setFormData({ ...formData, customerId: c.id, customerName: c.name });
                          setSearchQuery(c.name);
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[#353534] text-sm text-white border-b border-white/5 last:border-0"
                      >
                        <span className="font-bold text-[12px]">{c.name}</span>
                        <span className="text-white/40 text-[10px] ml-2">{c.phone}</span>
                      </button>
                    )) : (
                      <div className="px-3 py-2 text-[11px] text-white/30">Tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Motor / Plate */}
                <div className="relative">
                  <FieldLabel>Model Motor</FieldLabel>
                  <input
                    value={motorSearch}
                    onChange={e => { setMotorSearch(e.target.value); setShowMotorDropdown(true); }}
                    onFocus={() => setShowMotorDropdown(true)}
                    className="w-full h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
                    placeholder="NMax, Vario..."
                  />
                  {showMotorDropdown && filteredMotors.length > 0 && (
                    <div className="absolute z-30 w-full mt-0.5 bg-[#1c1b1b] border border-white/10 max-h-40 overflow-y-auto shadow-2xl">
                      {filteredMotors.map(m => (
                        <button key={m.model} type="button" onClick={() => handleSelectMotor(m)}
                          className="w-full px-3 py-2 text-left text-[11px] font-bold text-white hover:bg-[#353534] border-b border-white/5 last:border-0">
                          {m.model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <FieldLabel>Plate Number</FieldLabel>
                  <input
                    placeholder="B 1234 AB"
                    value={formData.plateNumber}
                    onChange={e => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="w-full h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
                  />
                </div>
              </div>

              {/* Registered Vehicles */}
              {selectedCustomer && selectedCustomer.vehicles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCustomer.vehicles.map(v => (
                    <button key={v.id} type="button"
                      onClick={() => {
                        setFormData({ ...formData, vehicleId: v.id, plateNumber: v.plateNumber || '' });
                        setMotorSearch(v.modelName);
                        const motorMatch = MOTOR_DATABASE.find(m =>
                          m.model.toLowerCase().includes(v.modelName.toLowerCase()) ||
                          v.modelName.toLowerCase().includes(m.model.toLowerCase())
                        );
                        if (motorMatch) handleSelectMotor(motorMatch);
                        else setSelectedMotor(null);
                      }}
                      className={`px-2.5 py-1 text-[9px] font-headline font-black uppercase tracking-wider border transition-all ${formData.vehicleId === v.id
                          ? 'bg-[#FFFF00]/10 border-[#FFFF00]/40 text-[#FFFF00]'
                          : 'bg-[#1c1b1b] border-white/8 text-white/30 hover:text-white hover:border-white/20'
                        }`}
                    >
                      {v.modelName}{v.plateNumber ? ` · ${v.plateNumber}` : ''}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Bookings */}
              {selectedCustomer && bookings.length > 0 && (
                <div>
                  <FieldLabel>Booking Aktif</FieldLabel>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {bookings.map(b => {
                      const remaining = (b.subtotal || 0) - (b.amountPaid || 0);
                      return (
                        <button key={b.id} type="button"
                          onClick={() => {
                            setFormData({ ...formData, bookingId: b.id, serviceType: b.serviceType, plateNumber: b.plateNumber || '', description: `Pembayaran Sisa Booking untuk ${b.serviceType}`, category: 'Repaint' });
                            setUseManualTotal(true);
                            setManualTotal(remaining);
                          }}
                          className={`flex justify-between items-center px-3 py-2 text-left border transition-all ${formData.bookingId === b.id
                              ? 'bg-[#FFFF00]/8 border-[#FFFF00]/30'
                              : 'bg-[#1c1b1b] border-white/8 hover:border-white/15'
                            }`}
                        >
                          <div>
                            <p className="text-[11px] font-bold text-white">{b.serviceType}</p>
                            <p className="text-[9px] text-white/30">{b.plateNumber || 'Tanpa Plat'} · {b.bookingDate}</p>
                          </div>
                          <span className="text-[10px] font-bold text-[#FFFF00]">Sisa: {formatRupiah(remaining)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SERVICE SELECTION ── */}
          {formData.type === 'income' && (
            <div>
              <SectionLabel icon="build" text="SERVICE SELECTION" />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {SERVICES.map(svc => (
                  <button key={svc.name} type="button" onClick={() => toggleService(svc)}
                    className={`px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider border transition-all ${cart.find(i => i.service.name === svc.name)
                        ? 'bg-[#FFFF00] border-[#FFFF00] text-[#131313]'
                        : 'bg-[#1c1b1b] border-white/10 text-white/40 hover:border-white/25 hover:text-white'
                      }`}
                  >
                    {svc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── CUSTOM SERVICE ── */}
          <div>
            <SectionLabel icon="edit_note" text="CUSTOM SERVICE" />
            <div className="flex gap-2 mt-3">
              <input
                value={customServiceDesc}
                onChange={e => setCustomServiceDesc(e.target.value)}
                placeholder="Service Description"
                className="flex-1 h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
              />
              <input
                value={customServicePrice}
                onChange={e => setCustomServicePrice(e.target.value)}
                type="number"
                placeholder="Price"
                className="w-28 h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
              />
              <button type="button" onClick={addCustomService}
                className="h-10 px-3 bg-[#1c1b1b] border border-white/10 text-white/40 hover:text-white hover:border-white/25 text-[11px] font-headline font-black transition-all">
                + ADD
              </button>
            </div>
          </div>

          {/* ── DISCOUNTS ── */}
          <div>
            <SectionLabel icon="sell" text="DISCOUNTS" />
            <div className="flex gap-2 mt-3 items-center">
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value as any)}
                className="h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[11px] font-bold outline-none focus:border-[#FFFF00]/40"
              >
                <option value="percentage">%</option>
                <option value="nominal">Rp Fixed</option>
              </select>
              <input
                type="number"
                value={discountValue || ''}
                onChange={e => setDiscountValue(parseInt(e.target.value) || 0)}
                placeholder="Rate"
                className="w-24 h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
              />
              {discountAmount > 0 && (
                <span className="text-[#ffb4ab] text-[11px] font-bold">- {formatRupiah(discountAmount)}</span>
              )}
            </div>
          </div>

          {/* ── META ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Kategori</FieldLabel>
              <input
                placeholder="Repaint, Gaji..."
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
              />
            </div>
            <div>
              <FieldLabel>Keterangan</FieldLabel>
              <input
                placeholder="Detail transaksi..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                required
                className="w-full h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
              />
            </div>
          </div>

          {formData.type === 'expense' && (
            <div>
              <FieldLabel>Nominal (IDR)</FieldLabel>
              <input
                type="number"
                placeholder="500000"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                className="w-full h-10 px-3 bg-[#1c1b1b] border border-white/8 text-white text-[12px] font-bold focus:border-[#FFFF00]/40 outline-none placeholder:text-white/20"
              />
            </div>
          )}
        </form>

        {/* ── RIGHT PANEL — ORDER SUMMARY ─────────────── */}
        <div className="w-[300px] shrink-0 bg-[#1a1a1a] border-l border-white/8 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <h3 className="font-headline font-black text-white uppercase tracking-widest text-[11px]">ORDER SUMMARY</h3>
            <span className="material-symbols-outlined text-white/30 text-[18px]">receipt_long</span>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-[10px] text-white/20 italic text-center pt-8">Belum ada layanan dipilih</p>
            ) : (
              cart.map(item => {
                const isSpot = item.service.name === 'Spot Repair';
                const itemTotal = isSpot
                  ? (item.spotCount || 1) * (item.spotPrice || 100000)
                  : (item.manualPrice ?? item.autoPrice);
                return (
                  <div key={item.service.name} className="group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-[12px] font-bold text-white">{item.service.name}</p>
                        {isSpot ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input type="number" min={1} value={item.spotCount || 1}
                              onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotCount: parseInt(e.target.value) || 1 } : i))}
                              className="w-10 bg-[#0e0e0e] border border-white/10 px-1.5 py-0.5 text-center text-white text-[10px] outline-none focus:border-[#FFFF00]/30"
                            />
                            <span className="text-[9px] text-white/30">spot × </span>
                            <input type="number" value={item.spotPrice || 100000}
                              onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotPrice: parseInt(e.target.value) || 0 } : i))}
                              className="w-20 bg-[#0e0e0e] border border-white/10 px-1.5 py-0.5 text-right text-[#FFFF00] text-[10px] font-bold outline-none focus:border-[#FFFF00]/30"
                            />
                          </div>
                        ) : (
                          <input type="number" value={item.manualPrice ?? item.autoPrice}
                            onChange={e => setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, manualPrice: parseInt(e.target.value) || 0 } : i))}
                            className="mt-1 w-full bg-[#0e0e0e] border border-white/10 px-2 py-0.5 text-right text-[#FFFF00]/70 text-[11px] font-bold outline-none focus:border-[#FFFF00]/30 focus:text-[#FFFF00]"
                          />
                        )}
                      </div>
                      <div className="flex items-start gap-2 ml-3">
                        <p className="text-[12px] font-bold text-white whitespace-nowrap">{formatRupiah(itemTotal)}</p>
                        <button type="button" onClick={() => toggleService(item.service)}
                          className="text-white/20 hover:text-[#ffb4ab] text-[13px] leading-none transition-colors mt-0.5">✕</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary Footer */}
          <div className="px-5 py-4 border-t border-white/8 space-y-3">
            {/* Down Payment toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-headline font-black text-white/40 uppercase tracking-widest">Down Payment</span>
              <button
                type="button"
                onClick={() => setDownPaymentEnabled(!downPaymentEnabled)}
                className={`relative w-10 h-5 transition-colors ${downPaymentEnabled ? 'bg-[#FFFF00]' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 size-4 bg-[#131313] transition-all ${downPaymentEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
            {downPaymentEnabled && (
              <input
                type="number"
                value={downPaymentAmount || ''}
                onChange={e => setDownPaymentAmount(parseInt(e.target.value) || 0)}
                placeholder="Jumlah DP"
                className="w-full h-8 px-3 bg-[#0e0e0e] border border-[#FFFF00]/20 text-[#FFFF00] text-[11px] font-bold outline-none placeholder:text-white/20"
              />
            )}

            {/* Payment Method */}
            <div>
              <FieldLabel>Payment Method</FieldLabel>
              <select
                value={formData.paymentMethod}
                onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full h-10 px-3 bg-[#0e0e0e] border border-white/10 text-white text-[11px] font-bold outline-none focus:border-[#FFFF00]/30 mt-1"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Special Price */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useManualTotal} onChange={e => setUseManualTotal(e.target.checked)}
                  className="size-3 bg-[#0e0e0e] accent-[#FFFF00]" />
                <span className="text-[9px] font-headline font-black text-[#FFFF00]/70 uppercase tracking-widest">Special Price</span>
              </label>
              {useManualTotal && (
                <input type="number" value={manualTotal || ''} onChange={e => setManualTotal(parseInt(e.target.value) || 0)}
                  className="flex-1 h-8 bg-[#FFFF00]/8 border border-[#FFFF00]/20 px-2 text-right text-[11px] text-[#FFFF00] font-bold outline-none" />
              )}
            </div>

            {/* Subtotal + Discount */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-white/40 font-headline font-black uppercase tracking-widest">
                <span>Subtotal</span>
                <span className="font-mono">{formatRupiah(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[10px] font-headline font-black uppercase tracking-widest">
                  <span className="text-[#ffb4ab]">
                    {discountType === 'percentage' ? `Promo Discount (${discountValue}% OFF)` : 'Discount'}
                  </span>
                  <span className="text-[#ffb4ab] font-mono">- {formatRupiah(discountAmount)}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-white/8">
              <p className="text-[10px] font-headline font-black text-white/40 uppercase tracking-widest">Total Amount</p>
              <p className="text-[28px] font-headline font-black text-[#FFFF00] leading-tight tracking-tight">
                {formatRupiah(grandTotal)}
              </p>
            </div>

            {/* Actions */}
            <button
              type="submit"
              form="transaction-form"
              onClick={handleSubmit as any}
              disabled={loading}
              className="w-full h-12 bg-[#FFFF00] text-[#131313] font-headline font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'MENYIMPAN...' : 'SIMPAN TRANSAKSI'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 border border-white/10 text-white/30 font-headline font-black text-[10px] uppercase tracking-widest hover:text-white hover:border-white/20 transition-all"
            >
              BATAL
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

// ── Helper Components ──────────────────────────────────────────

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-white/5">
      <span className="material-symbols-outlined text-[#FFFF00] text-[14px]">{icon}</span>
      <span className="text-[10px] font-headline font-black text-white/60 uppercase tracking-widest">{text}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-headline font-black text-white/30 uppercase tracking-widest mb-1">{children}</p>
  );
}