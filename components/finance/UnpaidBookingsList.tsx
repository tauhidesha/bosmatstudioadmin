'use client';

import { useState, useEffect, useRef } from 'react';
import { formatRupiah } from '@/lib/data/pricing';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSupabaseEvent } from '@/lib/hooks/useSupabaseEvent';

interface UnpaidBooking {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleModel: string | null;
  plateNumber: string | null;
  serviceType: string;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: string;
  status: string;
  bookingDate: Date;
  createdAt: Date;
  customer: {
    name: string;
    phone: string;
  };
  vehicle: {
    modelName: string;
    plateNumber: string;
  } | null;
}

export default function UnpaidBookingsList() {
  const [bookings, setBookings] = useState<UnpaidBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const router = useRouter();
  const { revision } = useSupabaseEvent({ table: 'Booking', event: '*' });
  const lastFetchRef = useRef(0);

  useEffect(() => {
    fetchUnpaidBookings();
  }, [revision]);

  // Polling fallback every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnpaidBookings();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchUnpaidBookings = async () => {
    // Debounce: skip if fetched within last 500ms
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;
    
    try {
      const res = await fetch('/api/finance/unpaid-bookings', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setBookings(json.data);
      }
    } catch (err) {
      console.error('Error fetching unpaid bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (booking: UnpaidBooking) => {
    if (!confirm(`Tandai booking ${booking.customerName} sebagai LUNAS?\nTotal: ${formatRupiah(booking.totalAmount)}`)) {
      return;
    }

    setPayingId(booking.id);
    try {
      const res = await fetch(`/api/finance/bookings/${booking.id}/mark-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: booking.totalAmount }),
      });

      const json = await res.json();
      if (json.success) {
        setBookings(prev => prev.filter(b => b.id !== booking.id));
        router.refresh();
      } else {
        alert(json.error || 'Gagal memproses pembayaran');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memproses pembayaran');
    } finally {
      setPayingId(null);
    }
  };

  const handleViewChat = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 text-neutral-500 animate-spin" />
        <span className="ml-2 text-xs text-neutral-500">Memuat tagihan...</span>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm text-neutral-400">Semua booking sudah lunas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map(booking => {
        const remaining = Math.max(0, booking.totalAmount - (booking.amountPaid || 0));
        const isPartial = booking.paymentStatus === 'PARTIAL';
        const vehicleLabel = booking.vehicle?.modelName 
          ? `${booking.vehicle.modelName}${booking.vehicle.plateNumber ? ` (${booking.vehicle.plateNumber})` : ''}`
          : booking.vehicleModel 
            ? `${booking.vehicleModel}${booking.plateNumber ? ` (${booking.plateNumber})` : ''}`
            : '-';

        const services = (booking.serviceType || '')
          .split(' § ')
          .map(s => s.split('||')[0].trim())
          .filter(Boolean)
          .join(', ');

        return (
          <div
            key={booking.id}
            className="bg-neutral-900/40 border border-white/5 p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white uppercase truncate">
                    {booking.customerName}
                  </h4>
                  <button
                    onClick={() => handleViewChat(booking.customerPhone || booking.customer?.phone)}
                    className="text-neutral-500 hover:text-[#FFFF00] transition-colors"
                    title="Lihat Chat"
                  >
                    <ExternalLink className="size-3" />
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5">{vehicleLabel}</p>
              </div>
              <span className={cn(
                "text-[9px] font-bold uppercase px-2 py-0.5",
                isPartial 
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              )}>
                {isPartial ? 'DP' : 'Belum Bayar'}
              </span>
            </div>

            {/* Services */}
            {services && (
              <p className="text-[10px] text-neutral-400 line-clamp-2">{services}</p>
            )}

            {/* Payment Info */}
            <div className="grid grid-cols-3 gap-3 bg-neutral-950/50 p-3">
              <div>
                <p className="text-[8px] text-neutral-600 uppercase">Total</p>
                <p className="text-xs font-mono text-white">{formatRupiah(booking.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[8px] text-neutral-600 uppercase">Terbayar</p>
                <p className="text-xs font-mono text-emerald-400">{formatRupiah(booking.amountPaid || 0)}</p>
              </div>
              <div>
                <p className="text-[8px] text-neutral-600 uppercase">Sisa</p>
                <p className="text-xs font-mono text-[#FFFF00]">{formatRupiah(remaining)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleMarkPaid(booking)}
                disabled={payingId === booking.id}
                className={cn(
                  "flex-1 py-2 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                  payingId === booking.id
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    : "bg-[#FFFF00] text-black hover:bg-[#e6e600] active:scale-[0.98]"
                )}
              >
                {payingId === booking.id ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" />
                    Lunas
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
