'use client';

export interface SegmentCustomer {
  id: string;
  name: string;
  phone: string;
  totalSpending: number;
  lastService: string | null;
  status: string;
  createdAt: string;
  aiLabel: string | null;
  aiStrategy: string | null;
  aiConfidence: number;
  aiReason: string | null;
  daysSinceLastChat: number | null;
  ghostedTimes: number;
}

// ── AI Label visual config ──────────────────────────────────────────────────
const LABEL_CONFIG: Record<string, { emoji: string; text: string; bg: string; text_color: string }> = {
  loyal:          { emoji: '👑', text: 'Loyal VIP',      bg: 'bg-amber-100',   text_color: 'text-amber-800' },
  existing:       { emoji: '✅', text: 'Pelanggan',      bg: 'bg-emerald-100', text_color: 'text-emerald-800' },
  hot_lead:       { emoji: '🔥', text: 'Hot Lead',       bg: 'bg-orange-100',  text_color: 'text-orange-800' },
  warm_lead:      { emoji: '🌤️',  text: 'Warm Lead',    bg: 'bg-yellow-100',  text_color: 'text-yellow-800' },
  window_shopper: { emoji: '👀', text: 'Window Shop',    bg: 'bg-slate-100',   text_color: 'text-slate-600' },
  churned:        { emoji: '⚠️', text: 'Churn',          bg: 'bg-red-100',     text_color: 'text-red-700' },
  dormant_lead:   { emoji: '😴', text: 'Dormant',        bg: 'bg-red-100',     text_color: 'text-red-700' },
};

function getInitials(name: string) {
  return name.substring(0, 2).toUpperCase();
}

function formatCurrency(amount: number) {
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}K`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

interface CustomerSegmentCardProps {
  customer: SegmentCustomer;
  variant: 'vip' | 'atRisk' | 'new';
  onClick: (c: SegmentCustomer) => void;
}

export function CustomerSegmentCard({ customer, variant, onClick }: CustomerSegmentCardProps) {
  const labelCfg = customer.aiLabel ? LABEL_CONFIG[customer.aiLabel] : null;

  const waLink = `https://wa.me/${customer.phone.replace(/\D/g, '')}`;

  // Avatar accent colors per variant
  const avatarAccent =
    variant === 'vip'     ? 'bg-amber-100 text-amber-700' :
    variant === 'atRisk'  ? 'bg-red-100 text-red-700' :
                            'bg-sky-100 text-sky-700';

  const borderAccent =
    variant === 'vip'     ? 'border-amber-200 hover:border-amber-400' :
    variant === 'atRisk'  ? 'border-red-200 hover:border-red-400' :
                            'border-sky-200 hover:border-sky-400';

  return (
    <div
      onClick={() => onClick(customer)}
      className={`bg-white border ${borderAccent} rounded-xl p-4 cursor-pointer 
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        flex flex-col gap-3 min-w-[220px] max-w-[260px] flex-shrink-0`}
    >
      {/* Header: Avatar + Name */}
      <div className="flex items-center gap-3">
        <div className={`size-10 rounded-full ${avatarAccent} flex items-center justify-center font-black text-sm flex-shrink-0`}>
          {getInitials(customer.name)}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-800 text-sm truncate">{customer.name}</div>
          <div className="text-[11px] text-slate-400 font-mono truncate">{customer.phone}</div>
        </div>
      </div>

      {/* AI Label Badge */}
      {labelCfg && (
        <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${labelCfg.bg} ${labelCfg.text_color}`}>
          <span>{labelCfg.emoji}</span>
          <span className="uppercase tracking-wide">{labelCfg.text}</span>
          {customer.aiConfidence > 0 && (
            <span className="opacity-60">{Math.round(customer.aiConfidence * 100)}%</span>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Revenue</span>
          <span className="font-bold text-slate-700">{formatCurrency(customer.totalSpending)}</span>
        </div>

        {variant === 'atRisk' && customer.ghostedTimes > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Ghosted</span>
            <span className="font-bold text-red-600">{customer.ghostedTimes}×</span>
          </div>
        )}

        {variant === 'atRisk' && customer.daysSinceLastChat !== null && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Tidak aktif</span>
            <span className={`font-bold ${customer.daysSinceLastChat > 60 ? 'text-red-600' : 'text-amber-600'}`}>
              {customer.daysSinceLastChat} hari
            </span>
          </div>
        )}

        {variant !== 'atRisk' && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Terakhir servis</span>
            <span className="font-medium text-slate-600">{formatDate(customer.lastService)}</span>
          </div>
        )}

        {variant === 'new' && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Bergabung</span>
            <span className="font-medium text-slate-600">{formatDate(customer.createdAt)}</span>
          </div>
        )}
      </div>

      {/* Quick Action */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest
          border border-slate-200 rounded-lg py-1.5 text-slate-500 
          hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">chat</span>
        WA
      </a>
    </div>
  );
}
