'use client';

import { useState, useEffect } from 'react';
import { Loader2, Send, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: {
    documentType?: string;
    customerName: string;
    customerPhone: string;
    motorDetails: string;
    items: string;
    subtotal?: number;
    discount?: number;
    totalAmount: number;
    amountPaid: number;
    downPayment?: number;
    paymentMethod: string;
    notes: string;
    bookingDate: string;
    realPhone?: string;
  };
  onSend: () => Promise<void>;
}

export default function InvoicePreviewModal({
  isOpen,
  onClose,
  invoiceData,
  onSend,
}: InvoicePreviewModalProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchPreview();
  }, [isOpen]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/invoice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData),
      });
      const json = await res.json();
      if (json.success) {
        setHtml(json.html);
      } else {
        setError(json.error || 'Gagal generate preview');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim invoice');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#131313] border border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#FFFF00]" />
            <h3 className="font-spartan text-sm uppercase tracking-widest text-white">
              Preview {invoiceData.documentType === 'tanda_terima' ? 'Receipt' : invoiceData.documentType === 'bukti_bayar' ? 'Payment' : 'Invoice'}
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 text-[#FFFF00] animate-spin" />
              <span className="ml-2 text-xs text-neutral-400">Generate preview...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-20">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchPreview}
                className="mt-4 text-[10px] text-[#FFFF00] uppercase font-bold hover:underline"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {html && !loading && (
            <iframe
              srcDoc={html}
              className="w-full h-[70vh] bg-[#131313] border border-white/5"
              title={`Preview ${invoiceData.documentType === 'tanda_terima' ? 'Receipt' : invoiceData.documentType === 'bukti_bayar' ? 'Payment' : 'Invoice'}`}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={fetchPreview}
            disabled={loading}
            className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={handleSend}
            disabled={sending || loading}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors",
              sending || loading
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-[#FFFF00] text-black hover:bg-[#e6e600]"
            )}
          >
            {sending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Send className="size-3" />
                Kirim ke WA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
