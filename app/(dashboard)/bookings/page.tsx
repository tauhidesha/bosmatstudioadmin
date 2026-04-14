'use client';

import React, { useState, useMemo } from 'react';
import { useBookings, Booking } from '@/lib/hooks/useBookings';
import { CalendarView } from '@/components/bookings/CalendarView';
import MobileBookingsView from '@/components/bookings/MobileBookingsView';
import { Button } from '@/components/ui/button';
import { Plus, Search, Bell, UserCircle } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import ManualBookingForm from '@/components/bookings/ManualBookingForm';
import { createApiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeConversations } from '@/lib/hooks/useRealtimeConversations';
import { useLayout } from '@/context/LayoutContext';
import { format, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { id } from 'date-fns/locale';
import { isBookingActiveOnDate } from '@/lib/utils/booking-visibility';

const statusConfig = {
  waiting:     { label: 'WAITING',    bg: 'bg-white/5',   text: 'text-white/40' },
  pending:     { label: 'PENDING',    bg: 'bg-white/5',   text: 'text-white/40' },
  in_progress: { label: 'ON GOING',  bg: 'bg-[#676700]', text: 'text-[#e6e67a]' },
  done:        { label: 'SELESAI',   bg: 'bg-white/10',  text: 'text-white/60' },
  paid:        { label: 'LUNAS',     bg: 'bg-green-900', text: 'text-green-400' },
  cancelled:   { label: 'BATAL',     bg: 'bg-red-950',   text: 'text-red-400' },
};

export default function BookingsPage() {
  const { bookings, loading, updateBookingStatus, deleteBooking, updateBooking } = useBookings();
  const { conversations } = useRealtimeConversations();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Payment Modal States
  const [paymentModal, setPaymentModal] = useState<Booking | null>(null);
  const [nominalDP, setNominalDP] = useState<number>(0);
  const [metodePembayaran, setMetodePembayaran] = useState('Transfer BCA');
  const [sendInvoice, setSendInvoice] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { setHeaderTitle, setHeaderExtra } = useLayout();
  const { getIdToken } = useAuth();

  const apiClient = useMemo(() => createApiClient(
    process.env.NEXT_PUBLIC_API_URL || '/api',
    getIdToken
  ), [getIdToken]);

  React.useEffect(() => {
    setHeaderTitle('MANAJEMEN BOOKING');
    setHeaderExtra(
      <div className="relative group w-full max-w-md hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40 group-focus-within:text-[#FFFF00] transition-colors" />
        <input 
          className="bg-[#1C1B1B] border-none focus:ring-0 text-xs w-full pl-10 py-2.5 rounded-sm placeholder:text-white/20 text-white font-headline" 
          placeholder="Cari jadwal atau nama customer..." 
          type="text"
        />
      </div>
    );
    return () => {
      setHeaderTitle('SYSTEM OVERVIEW');
      setHeaderExtra(null);
    };
  }, [setHeaderTitle, setHeaderExtra]);

  // Handle estimated revenue and stats calculations...
  const queueBookings = useMemo(() => {
    return bookings
      .filter(b => isBookingActiveOnDate(b, selectedDate))
      .sort((a, b) => (a.bookingTime || '00:00') > (b.bookingTime || '00:00') ? 1 : -1);
  }, [bookings, selectedDate]);

  const todayStats = useMemo(() => {
    return {
      filled: queueBookings.length,
      available: Math.max(0, 10 - queueBookings.length)
    };
  }, [queueBookings]);

  const estimatedRevenue = useMemo(() => {
    return queueBookings.reduce((sum, b) => sum + (Number(b.totalAmount !== null ? b.totalAmount : b.subtotal) || 500000), 0);
  }, [queueBookings]);

  const handlePayAndInvoice = async () => {
    if (!paymentModal) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${paymentModal.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: metodePembayaran,
          amountPaid: nominalDP || undefined,
          sendInvoice,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memproses pembayaran');

      setPaymentModal(null);
      setNominalDP(0);
      setSendInvoice(true);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses pembayaran');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#131313]">
        <div className="animate-spin size-10 border-4 border-[#FFFF00]/10 border-t-[#FFFF00] rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#131313] overflow-hidden">
      {/* Search bar inside the Global Header via layout context if needed, but for now we rely on Global Header Title */}

      {/* ── MAIN CONTENT (CALENDAR + SIDEBAR) ── */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-hidden mt-2">
        
        {/* Left Section: Calendar Canvas */}
        <section className="flex-1 p-8 overflow-y-auto no-scrollbar flex flex-col">
          <CalendarView 
            bookings={bookings} 
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onDateSelect={setSelectedDate}
            selectedDate={selectedDate}
          />
          
          {/* New Booking Button triggers Modal */}
          <div className="mt-8 flex justify-end">
            <button 
              onClick={() => {
                setEditingBooking(null);
                setShowBookingModal(true);
              }}
              className="bg-[#FFFF00] text-[#131313] font-black text-xs px-8 h-12 tracking-widest rounded-sm transition-transform active:scale-95 font-headline uppercase"
            >
              NEW BOOKING
            </button>
          </div>
        </section>

        {/* Right Section: Today's Queue Sidebar */}
        <aside className="w-[420px] bg-[#1C1B1B] border-l border-white/5 flex flex-col shrink-0">
          <div className="p-8 border-b border-white/5 bg-[#2A2A2A]/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-black font-display tracking-tighter text-[#FFFF00] uppercase italic">
                ANTREAN {format(selectedDate, 'dd MMMM', { locale: id }).toUpperCase()}
              </h3>
              <span className="bg-[#FFFF00] text-[#131313] text-[9px] font-black px-2 py-0.5 rounded-sm font-headline tracking-widest italic">
                {format(selectedDate, 'MMM dd', { locale: id }).toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-white/40">schedule</span>
              <p className="text-[10px] text-white/40 font-bold font-headline uppercase tracking-[0.2em]">
                {todayStats.filled} Slots Terisi / {todayStats.available} Tersedia
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
            {queueBookings.length > 0 ? (
              queueBookings.map((booking) => (
                <div 
                  key={booking.id}
                  onClick={() => {
                    setEditingBooking(booking);
                    setShowBookingModal(true);
                  }}
                  className={cn(
                    "p-5 border-l-2 group hover:bg-[#353534] transition-all cursor-pointer relative",
                    booking.status === 'in_progress' 
                      ? "bg-[#2A2A2A] border-[#FFFF00]" 
                      : "bg-[#0E0E0E] border-white/10"
                  )}
                >
                  {/* Edit Indicator on hover */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 p-1 rounded-sm">
                    <span className="material-symbols-outlined text-[10px] text-white/40">edit</span>
                  </div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className={cn(
                        "text-[10px] font-bold tracking-widest font-headline",
                        booking.status === 'in_progress' ? "text-[#FFFF00]" : "text-white/40"
                      )}>
                        {booking.bookingTime || '09:00'} WIB
                      </p>
                      <h4 className="text-lg font-black font-display uppercase tracking-tight text-white leading-tight">
                        {booking.customerName}
                      </h4>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-1 rounded-sm font-headline uppercase tracking-widest",
                      statusConfig[booking.status as keyof typeof statusConfig]?.bg || 'bg-white/5',
                      statusConfig[booking.status as keyof typeof statusConfig]?.text || 'text-white/40'
                    )}>
                      {statusConfig[booking.status as keyof typeof statusConfig]?.label || 'WAITING'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-white/40">two_wheeler</span>
                      <p className="text-xs font-bold text-white/80 font-headline uppercase tracking-tight">
                        {booking.vehicleInfo || 'Unknown Vehicle'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-white/40">build</span>
                      <p className="text-[11px] text-white/60 font-body">
                        {Array.isArray(booking.services) ? booking.services.join(' / ') : booking.services}
                      </p>
                    </div>
                  </div>

                  {/* Quick Status Bar */}
                  <div className="flex gap-1 mt-3 pt-3 border-t border-white/5">
                    {(booking.status === 'waiting' || booking.status === 'pending') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateBookingStatus(booking.id, 'in_progress');
                        }}
                        className="flex-1 py-1.5 text-[9px] font-black font-headline uppercase tracking-widest bg-[#676700] text-[#e6e67a] hover:bg-[#FFFF00] hover:text-[#1d1d00] transition-all"
                      >
                        ▶ Mulai Proses
                      </button>
                    )}

                    {booking.status === 'in_progress' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateBookingStatus(booking.id, 'done');
                        }}
                        className="flex-1 py-1.5 text-[9px] font-black font-headline uppercase tracking-widest bg-[#353534] text-white/60 hover:bg-white hover:text-[#131313] transition-all"
                      >
                        ✓ Tandai Selesai
                      </button>
                    )}

                    {booking.status === 'done' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModal(booking);
                          setNominalDP(Math.max(0, Number(booking.totalAmount || booking.subtotal || 0) - Number(booking.downPayment || 0)));
                        }}
                        className="flex-1 py-1.5 text-[9px] font-black font-headline uppercase tracking-widest bg-[#FFFF00] text-[#1d1d00] hover:brightness-110 transition-all"
                      >
                        ⚡ Bayar & Invoice
                      </button>
                    )}

                    {booking.status === 'paid' && (
                      <span className="flex-1 py-1.5 text-[9px] font-black font-headline uppercase tracking-widest text-center text-green-400">
                        ✓ Lunas
                      </span>
                    )}

                    {!['done', 'paid', 'cancelled'].includes(booking.status) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Batalkan booking ini?')) updateBookingStatus(booking.id, 'cancelled');
                        }}
                        className="px-3 py-1.5 text-[9px] font-black font-headline uppercase text-white/20 hover:text-red-400 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                 <span className="material-symbols-outlined text-6xl">calendar_month</span>
                 <p className="font-headline font-black text-xs uppercase mt-4">Tidak ada jadwal</p>
              </div>
            )}
          </div>

          {/* Revenue Summary Footer */}
          <div className="p-6 bg-[#2A2A2A] border-t border-white/5">
            <div className="flex justify-between items-center text-[10px] font-black font-headline tracking-widest uppercase mb-2">
              <span className="text-white/40">Estimasi Pendapatan ({format(selectedDate, 'dd/MM')})</span>
              <span className="text-[#FFFF00]">Rp {estimatedRevenue.toLocaleString()}</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#FFFF00]" 
                style={{ width: `${Math.min(100, (estimatedRevenue / 5000000) * 100)}%` }} 
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile View */}
      <div className="md:hidden flex-1 overflow-y-auto no-scrollbar">
        <MobileBookingsView
          bookings={bookings}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onNewBooking={() => {
            setEditingBooking(null);
            setShowBookingModal(true);
          }}
          onEditBooking={(booking) => {
            setEditingBooking(booking);
            setShowBookingModal(true);
          }}
          onDeleteBooking={deleteBooking}
          onUpdateStatus={updateBookingStatus}
          onOpenPayment={(booking) => {
            setPaymentModal(booking);
            setNominalDP(Math.max(0, Number(booking.totalAmount || booking.subtotal || 0) - Number(booking.downPayment || 0)));
          }}
        />
      </div>

      {/* Manual Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        size="full"
        showHeader={false}
      >
        <ManualBookingForm
          apiClient={apiClient}
          allConversations={conversations}
          initialData={editingBooking}
          onDelete={deleteBooking}
          onUpdate={updateBooking}
          onSuccess={() => {
            setShowBookingModal(false);
            setEditingBooking(null);
          }}
          onCancel={() => {
            setShowBookingModal(false);
            setEditingBooking(null);
          }}
        />
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={!!paymentModal}
        onClose={() => setPaymentModal(null)}
        size="md"
        showHeader={false}
      >
        <div className="p-8 bg-[#131313] flex flex-col gap-6 font-body">
          <div>
            <h3 className="font-headline font-black text-xl uppercase text-[#FFFF00]">⚡ Bayar & Invoice</h3>
            <p className="text-white/40 text-xs font-headline uppercase tracking-widest mt-1">
              {paymentModal?.customerName} — {paymentModal?.vehicleInfo}
            </p>
          </div>

          {/* Total */}
          <div className="bg-[#1c1b1b] p-4 flex flex-col gap-2 rounded-sm">
            {(paymentModal?.downPayment || 0) > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-white/40 text-xs font-headline uppercase tracking-widest">Subtotal</span>
                  <span className="font-headline text-white/60">
                    Rp {Number(paymentModal?.totalAmount || paymentModal?.subtotal || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#FFFF00]">
                  <span className="text-xs font-headline uppercase tracking-widest">DP (Sudah Dibayar)</span>
                  <span className="font-headline">
                    - Rp {Number(paymentModal?.downPayment || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="h-px w-full bg-white/10 my-1 font-headline" />
              </>
            )}
            <div className="flex justify-between items-center">
              <span className="text-white/40 text-xs font-headline uppercase tracking-widest">
                {(paymentModal?.downPayment || 0) > 0 ? 'Sisa Tagihan' : 'Total Tagihan'}
              </span>
              <span className="font-headline font-black text-xl text-white">
                Rp {Math.max(0, Number(paymentModal?.totalAmount || paymentModal?.subtotal || 0) - Number(paymentModal?.downPayment || 0)).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Nominal Bayar */}
          <div className="space-y-1">
            <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Nominal Dibayar</label>
            <input
              type="number"
              value={nominalDP || ''}
              onChange={e => setNominalDP(Number(e.target.value))}
              className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-[#FFFF00] text-right font-mono"
              placeholder="0"
            />
          </div>

          {/* Metode */}
          <div className="space-y-1">
            <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Metode Pembayaran</label>
            <select
              value={metodePembayaran}
              onChange={e => setMetodePembayaran(e.target.value)}
              className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white"
            >
              <option>Tunai</option>
              <option>Transfer BCA</option>
              <option>QRIS</option>
            </select>
          </div>

          {/* Kirim Invoice Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer bg-[#1c1b1b] p-3 rounded-sm">
            <input
              type="checkbox"
              checked={sendInvoice}
              onChange={e => setSendInvoice(e.target.checked)}
              className="size-4 accent-[#FFFF00]"
            />
            <div>
              <span className="text-[11px] font-headline font-bold text-white uppercase tracking-wider">Kirim Invoice & Garansi</span>
              <p className="text-[9px] text-white/30 mt-0.5">Kirim PDF invoice + garansi via WhatsApp ke customer</p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setPaymentModal(null)}
              className="px-6 py-4 text-[10px] font-headline font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handlePayAndInvoice}
              disabled={isProcessing}
              className="flex-1 py-4 bg-[#FFFF00] text-[#1d1d00] font-headline font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="animate-spin size-4 border-2 border-[#1d1d00] border-t-transparent rounded-full" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              )} 
              {isProcessing ? 'Memproses...' : sendInvoice ? 'Bayar & Kirim Invoice' : 'Simpan Pembayaran'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


