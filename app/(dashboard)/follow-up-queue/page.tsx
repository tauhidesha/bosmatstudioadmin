'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  docId: string;
  senderNumber: string;
  name: string;
  customerLabel: string | null;
  type: QueueType;
  strategy: { angle?: string } | null;
  generatedMessage: string;
  maintenanceDate?: string;
  diffDays?: number;
  bookingDate?: string;
  bookingTime?: string;
  approved?: boolean;
  editedMessage?: string;
}

type QueueType = 'nurturing' | 'review' | 'rebooking' | 'coating_reminder' | 'booking_reminder';

interface LocalItem extends QueueItem {
  approved: boolean;
  editedMessage: string;
}

interface ExecuteStatus {
  running: boolean;
  total: number;
  sent: number;
  errors: number;
  current: { senderNumber: string; type: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_TABS: { label: string; value: QueueType | 'all' }[] = [
  { label: 'Semua', value: 'all' },
  { label: 'Nurturing', value: 'nurturing' },
  { label: 'Review', value: 'review' },
  { label: 'Rebooking', value: 'rebooking' },
  { label: 'Coating Reminder', value: 'coating_reminder' },
  { label: 'Booking Reminder', value: 'booking_reminder' },
];

const TYPE_BADGE: Record<QueueType, { label: string; className: string }> = {
  nurturing:        { label: 'Nurturing',        className: 'bg-[#1e1e1e] text-slate-300 border border-[#2A2A2A]' },
  review:           { label: 'Review',           className: 'bg-[#0d1f3c] text-blue-300 border border-blue-800' },
  rebooking:        { label: 'Rebooking',        className: 'bg-[#0c2910] text-green-300 border border-green-800' },
  coating_reminder: { label: 'Coating 🛡️',      className: 'bg-[#2c2000] text-amber-300 border border-amber-700' },
  booking_reminder: { label: 'Booking 🗓️',      className: 'bg-[#2a1000] text-orange-300 border border-orange-700' },
};

const LABEL_BADGE: Record<string, string> = {
  hot:       'bg-red-900/30 text-red-300 border border-red-700',
  warm_lead: 'bg-orange-900/30 text-orange-300 border border-orange-700',
  warm:      'bg-yellow-900/30 text-yellow-300 border border-yellow-700',
  cold:      'bg-slate-800 text-slate-400 border border-slate-600',
};

function maskPhone(phone: string): string {
  const digits = phone.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
  if (digits.length < 6) return digits;
  return digits.slice(0, 4) + '****' + digits.slice(-3);
}

function isBefore9AM(): boolean {
  const now = new Date();
  // Use Asia/Jakarta timezone
  const jakartaHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false })
  );
  return jakartaHour < 9;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FollowUpQueuePage() {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [filter, setFilter] = useState<QueueType | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [delayMin, setDelayMin] = useState(5); // delay in minutes
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState<ExecuteStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const delayMs = delayMin * 60 * 1000;

  // ── Poll execute status ────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/follow-up-queue/execute-status', { cache: 'no-store' });
        const data: ExecuteStatus & { success: boolean } = await res.json();
        setExecStatus(data);
        if (!data.running && data.finishedAt) {
          stopPolling();
          setExecuting(false);
          showToast(`✅ ${data.sent} pesan terkirim${data.errors ? `, ${data.errors} error` : ''}.`, true);
          // Remove sent items
          setItems(prev => {
            const failedDocIds = new Set(
              (data as any).results?.filter((r: any) => r.status === 'error').map((r: any) => r.docId) || []
            );
            return prev.filter(i => !i.approved || failedDocIds.has(i.docId));
          });
        }
      } catch { /* ignore */ }
    }, 5000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Auto-load saved queue on mount (only if before 9 AM) ──────────────────

  useEffect(() => {
    if (!isBefore9AM()) return; // After 9 AM: don't auto-load, let user generate fresh

    (async () => {
      try {
        const res = await fetch('/api/follow-up-queue/saved', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.exists && data.queue.length > 0) {
          const localItems: LocalItem[] = data.queue.map((item: QueueItem) => ({
            ...item,
            approved: item.approved ?? true,
            editedMessage: item.editedMessage ?? item.generatedMessage,
          }));
          setItems(localItems);
          setDelayMin(Math.round((data.delayMs || 300000) / 60000));
          setSavedAt(data.savedAt);
          showToast(`📋 Queue tersimpan dimuat (${localItems.length} item). Siap untuk jam 9 AM.`, true);
        }
      } catch { /* ignore */ }
    })();

    // Also check if execute is already running
    (async () => {
      try {
        const res = await fetch('/api/follow-up-queue/execute-status', { cache: 'no-store' });
        const data = await res.json();
        if (data.running) {
          setExecuting(true);
          setExecStatus(data);
          startPolling();
        }
      } catch { /* ignore */ }
    })();
  }, [startPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Generate Queue ─────────────────────────────────────────────────────────

  const generateQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setSavedAt(null);

    try {
      const res = await fetch('/api/follow-up-queue', { cache: 'no-store' });

      if (res.status === 409) {
        setError('⚠️ Cronjob sedang berjalan. Tunggu beberapa menit sebelum generate queue.');
        return;
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Server error');

      const localItems: LocalItem[] = (data.queue as QueueItem[]).map(item => ({
        ...item,
        approved: true,
        editedMessage: item.generatedMessage,
      }));

      setItems(localItems);
      if (localItems.length === 0) showToast('Queue kosong — tidak ada pesan yang dijadwalkan hari ini.', true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Save Queue to DB ───────────────────────────────────────────────────────

  const saveQueue = useCallback(async () => {
    setSaving(true);
    try {
      const payload = items.map(i => ({
        docId: i.docId,
        senderNumber: i.senderNumber,
        name: i.name,
        customerLabel: i.customerLabel,
        type: i.type,
        strategy: i.strategy,
        generatedMessage: i.generatedMessage,
        editedMessage: i.editedMessage,
        approved: i.approved,
        // Include the message field that execute endpoint reads
        message: i.editedMessage,
      }));

      const res = await fetch('/api/follow-up-queue/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload, delayMs }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');

      setSavedAt(new Date().toISOString());
      showToast(`💾 ${data.saved} item tersimpan. Queue akan dieksekusi jam 9 AM besok.`, true);
    } catch (err: any) {
      showToast(`❌ ${err.message}`, false);
    } finally {
      setSaving(false);
    }
  }, [items, delayMs]);

  // ── Clear Saved Queue ──────────────────────────────────────────────────────

  const clearSaved = useCallback(async () => {
    try {
      await fetch('/api/follow-up-queue/saved', { method: 'DELETE' });
      setSavedAt(null);
      showToast('🗑️ Saved queue dihapus.', true);
    } catch { /* ignore */ }
  }, []);

  // ── Execute Now ────────────────────────────────────────────────────────────

  const executeQueue = useCallback(async () => {
    const approvedItems = items.filter(i => i.approved);
    if (approvedItems.length === 0) {
      showToast('Tidak ada item yang di-approve untuk dikirim.', false);
      return;
    }

    setExecuting(true);
    try {
      const payload = approvedItems.map(i => ({
        docId: i.docId,
        senderNumber: i.senderNumber,
        type: i.type,
        message: i.editedMessage,
        approved: true,
      }));

      const res = await fetch('/api/follow-up-queue/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload, delayMs }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Execute failed');

      // 202 Accepted — start polling
      showToast(`🚀 ${data.accepted} pesan diantrekan. Jeda ${delayMin} mnt antar pesan.`, true);
      startPolling();
    } catch (err: any) {
      showToast(`❌ ${err.message}`, false);
      setExecuting(false);
    }
  }, [items, delayMs, delayMin, startPolling]);

  // ── Item helpers ───────────────────────────────────────────────────────────

  const toggleApprove = (docId: string) => {
    setItems(prev => prev.map(i => i.docId === docId ? { ...i, approved: !i.approved } : i));
  };

  const updateMessage = (docId: string, value: string) => {
    setItems(prev => prev.map(i => i.docId === docId ? { ...i, editedMessage: value } : i));
  };

  const removeItem = (docId: string) => {
    setItems(prev => prev.filter(i => i.docId !== docId));
  };

  const approveAll = () => setItems(prev => prev.map(i => ({ ...i, approved: true })));
  const rejectAll  = () => setItems(prev => prev.map(i => ({ ...i, approved: false })));

  // ── Derived ────────────────────────────────────────────────────────────────

  const visible = filter === 'all' ? items : items.filter(i => i.type === filter);
  const approvedCount = items.filter(i => i.approved).length;
  const estMs = approvedCount * (delayMs + 1500);
  const estLabel = approvedCount === 0 ? null
    : estMs < 60000
      ? `~${Math.ceil(estMs / 1000)} detik`
      : `~${Math.ceil(estMs / 60000)} mnt`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full bg-[#131313] p-6 overflow-auto text-[#e5e2e1]">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 text-xs font-bold px-4 py-3 border
            ${toast.ok
              ? 'bg-[#0c2910] border-green-700 text-green-300'
              : 'bg-[#2c0b0b] border-red-700 text-red-300'
            } shadow-lg transition-all`}
        >
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-headline font-black text-white tracking-widest uppercase py-2">
            Follow-Up <span className="text-[#FFFF00]">Queue Review</span>
          </h1>
          <p className="text-[10px] text-slate-500 tracking-widest uppercase">
            Preview & approve outbound messages sebelum cronjob 09:00 trigger
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">

          {/* Delay input */}
          <div className="flex items-center gap-1.5 border border-[#2A2A2A] bg-[#1C1B1B] px-3 py-2">
            <span className="material-symbols-outlined text-slate-500 text-sm">timer</span>
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={delayMin}
              onChange={e => setDelayMin(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={executing}
              className="w-10 bg-transparent text-[10px] font-mono text-slate-300 text-right
                focus:outline-none disabled:opacity-40"
            />
            <span className="text-[9px] text-slate-600 tracking-widest">mnt</span>
          </div>

          {/* Est time */}
          {estLabel && (
            <div className="flex items-center gap-1 text-[9px] text-slate-500 border border-[#2A2A2A] bg-[#1C1B1B] px-3 py-2">
              <span className="material-symbols-outlined text-slate-600 text-sm">hourglass_empty</span>
              <span>Selesai dalam <span className="text-[#FFFF00] font-mono">{estLabel}</span></span>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={generateQueue}
            disabled={loading || executing}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest
              px-4 py-2 border border-[#FFFF00] text-[#FFFF00] bg-[#1a1a00]
              hover:bg-[#FFFF00] hover:text-black transition-colors active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'progress_activity' : 'sync'}
            </span>
            {loading ? 'Generating...' : 'Generate Queue'}
          </button>

          {/* Save for 9AM */}
          {items.length > 0 && (
            <button
              onClick={saveQueue}
              disabled={saving || executing}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest
                px-4 py-2 border border-amber-600 text-amber-300 bg-[#2c2000]
                hover:bg-amber-700 hover:text-white transition-colors active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-sm ${saving ? 'animate-spin' : ''}`}>
                {saving ? 'progress_activity' : 'save'}
              </span>
              {saving ? 'Saving...' : 'Simpan Jam 9 AM'}
            </button>
          )}

          {/* Execute Now */}
          {items.length > 0 && (
            <button
              onClick={executeQueue}
              disabled={executing || loading || approvedCount === 0}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest
                px-4 py-2 border border-green-600 text-green-300 bg-[#0c2910]
                hover:bg-green-700 hover:text-white transition-colors active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-sm ${executing ? 'animate-spin' : ''}`}>
                {executing ? 'progress_activity' : 'send'}
              </span>
              {executing ? 'Sending...' : `Kirim ${approvedCount} Sekarang`}
            </button>
          )}
        </div>
      </div>

      {/* Saved Queue Banner */}
      {savedAt && !executing && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 bg-[#2c2000] border border-amber-700 text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span>Queue tersimpan — akan dieksekusi jam <strong>9 AM</strong> besok · Disimpan {new Date(savedAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button onClick={clearSaved} className="text-[9px] text-amber-500 hover:text-amber-300 underline">Hapus</button>
        </div>
      )}

      {/* Execute Progress Bar */}
      {executing && execStatus && (
        <div className="mb-4 px-4 py-3 bg-[#0c2910] border border-green-700 text-green-300 text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              <span>Mengirim... <strong>{execStatus.sent}</strong>/{execStatus.total} terkirim
                {execStatus.errors > 0 && <span className="text-red-400 ml-2">· {execStatus.errors} error</span>}
              </span>
            </div>
            {execStatus.current && (
              <span className="text-[9px] text-green-500 font-mono">
                ▶ {execStatus.current.type} → {maskPhone(execStatus.current.senderNumber)}
              </span>
            )}
          </div>
          <div className="w-full bg-[#1C1B1B] h-1.5">
            <div
              className="bg-green-500 h-1.5 transition-all duration-500"
              style={{ width: `${execStatus.total > 0 ? (execStatus.sent / execStatus.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-950 border border-red-700 text-red-300 text-xs">
          ❌ {error}
        </div>
      )}

      {/* Summary bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-4 mb-4 px-1 text-[10px] text-slate-500 tracking-widest">
          <span>{items.length} total</span>
          <span>·</span>
          <span className="text-green-400">{approvedCount} approved</span>
          <span>·</span>
          <span className="text-red-400">{items.length - approvedCount} rejected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={approveAll} className="text-green-400 hover:text-green-300 transition-colors">Approve All</button>
            <span>·</span>
            <button onClick={rejectAll} className="text-red-400 hover:text-red-300 transition-colors">Reject All</button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {items.length > 0 && (
        <div className="flex gap-1 mb-5 flex-wrap">
          {TYPE_TABS.map(tab => {
            const count = tab.value === 'all'
              ? items.length
              : items.filter(i => i.type === tab.value).length;
            if (tab.value !== 'all' && count === 0) return null;
            return (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest border transition-colors
                  ${filter === tab.value
                    ? 'border-[#FFFF00] text-[#FFFF00] bg-[#1a1a00]'
                    : 'border-[#2A2A2A] text-slate-400 bg-[#1C1B1B] hover:border-slate-500'
                  }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Cards */}
      {visible.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <span className="material-symbols-outlined text-5xl mb-3">campaign</span>
          <p className="text-[11px] tracking-widest uppercase">
            {items.length === 0
              ? isBefore9AM()
                ? 'Klik "Generate Queue" atau queue tersimpan akan muncul otomatis.'
                : 'Sudah lewat jam 9 AM. Klik "Generate Queue" untuk generate baru.'
              : 'Tidak ada item untuk filter ini.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map(item => {
          const badge = TYPE_BADGE[item.type];
          const labelClass = item.customerLabel ? LABEL_BADGE[item.customerLabel] || LABEL_BADGE.cold : null;
          const isOverdue = (item.type === 'coating_reminder' || item.type === 'booking_reminder')
            && item.diffDays !== undefined && item.diffDays <= 0;

          return (
            <div
              key={item.docId}
              className={`
                flex flex-col border bg-[#1C1B1B] transition-colors
                ${item.approved ? 'border-[#2A2A2A]' : 'border-[#2a1010] opacity-60'}
              `}
            >
              {/* Card header */}
              <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[#222]">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-sm font-bold text-white truncate">{item.name}</span>
                  <span className="text-[9px] text-slate-600 tracking-widest font-mono">
                    {maskPhone(item.senderNumber)}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <span className={`text-[8px] font-bold tracking-wider px-2 py-0.5 ${badge.className}`}>
                      {badge.label}
                    </span>
                    {labelClass && item.customerLabel && (
                      <span className={`text-[8px] font-bold tracking-wider px-2 py-0.5 ${labelClass}`}>
                        {item.customerLabel}
                      </span>
                    )}
                    {isOverdue && (
                      <span className="text-[8px] font-bold tracking-wider px-2 py-0.5 bg-red-950 text-red-400 border border-red-700">
                        ⚠️ OVERDUE
                      </span>
                    )}
                    {item.type === 'coating_reminder' && item.diffDays !== undefined && !isOverdue && (
                      <span className="text-[8px] text-amber-500">H-{item.diffDays}</span>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button
                    onClick={() => toggleApprove(item.docId)}
                    title={item.approved ? 'Reject' : 'Approve'}
                    className={`w-7 h-7 flex items-center justify-center border transition-colors text-sm
                      ${item.approved
                        ? 'border-green-600 text-green-400 bg-green-950 hover:bg-green-900'
                        : 'border-red-600 text-red-400 bg-red-950 hover:bg-red-900'
                      }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {item.approved ? 'check_circle' : 'cancel'}
                    </span>
                  </button>

                  <button
                    onClick={() => removeItem(item.docId)}
                    title="Hapus dari queue"
                    className="w-7 h-7 flex items-center justify-center border border-[#2A2A2A]
                      text-slate-600 hover:border-red-700 hover:text-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>

              {/* Message editor */}
              <div className="px-4 py-3 flex-1">
                <label className="block text-[8px] uppercase tracking-widest text-slate-600 mb-1.5">
                  Pesan (editable)
                </label>
                <textarea
                  value={item.editedMessage}
                  onChange={e => updateMessage(item.docId, e.target.value)}
                  rows={6}
                  className="w-full bg-[#131313] border border-[#2A2A2A] text-[11px] text-slate-300
                    font-mono leading-relaxed px-3 py-2 resize-none
                    focus:outline-none focus:border-[#FFFF00] transition-colors"
                />
                {item.editedMessage !== item.generatedMessage && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-amber-400 text-xs">edit</span>
                    <span className="text-[9px] text-amber-500">Edited</span>
                    <button
                      onClick={() => updateMessage(item.docId, item.generatedMessage)}
                      className="ml-auto text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="px-4 pb-3 text-[9px] text-slate-700 flex items-center gap-2">
                {item.strategy?.angle && (
                  <span>angle: <span className="text-slate-500">{item.strategy.angle}</span></span>
                )}
                {item.bookingDate && (
                  <>
                    <span>·</span>
                    <span>booking: <span className="text-slate-500">{new Date(item.bookingDate).toLocaleDateString('id-ID')}</span>
                      {item.bookingTime && ` ${item.bookingTime}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-52 bg-[#1C1B1B] border border-[#2A2A2A] animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
