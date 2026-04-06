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
  loyal:          { emoji: '👑', text: 'Loyal VIP',      bg: 'bg-[#323200]',   text_color: 'text-[#FFFF00]' },
  existing:       { emoji: '✅', text: 'Pelanggan',      bg: 'bg-emerald-950', text_color: 'text-emerald-400' },
  hot_lead:       { emoji: '🔥', text: 'Hot Lead',       bg: 'bg-orange-950',  text_color: 'text-orange-400' },
  warm_lead:      { emoji: '🌤️',  text: 'Warm Lead',    bg: 'bg-yellow-950',  text_color: 'text-yellow-400' },
  window_shopper: { emoji: '👀', text: 'Window Shop',    bg: 'bg-slate-800',   text_color: 'text-slate-300' },
  churned:        { emoji: '⚠️', text: 'Churn',          bg: 'bg-red-950',     text_color: 'text-red-400' },
  dormant_lead:   { emoji: '😴', text: 'Dormant',        bg: 'bg-red-950',     text_color: 'text-red-400' },
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
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
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

  const avatarAccent =
    variant === 'vip'     ? 'bg-[#FFFF00] text-[#131313]' :
    variant === 'atRisk'  ? 'bg-red-500 text-white' :
                            'bg-sky-500 text-white';

  const borderAccent =
    variant === 'vip'     ? 'border-[#323200] hover:border-[#FFFF00]' :
    variant === 'atRisk'  ? 'border-red-900 hover:border-red-500' :
                            'border-sky-900 hover:border-sky-500';

  return (
    <div
      onClick={() => onClick(customer)}
      className={`bg-[#1C1B1B] border ${borderAccent} rounded-sm p-5 cursor-pointer 
        transition-colors hover:bg-[#201f1f]
        flex flex-col gap-4 min-w-[240px] max-w-[280px] flex-shrink-0 relative group`}
    >
      {/* Decorative top border */}
      <div className={`absolute top-0 left-0 w-full h-[2px] transition-opacity opacity-0 group-hover:opacity-100
        ${variant === 'vip' ? 'bg-[#FFFF00]' : variant === 'atRisk' ? 'bg-red-500' : 'bg-sky-500'}`} 
      />

      {/* Header: Avatar + Name */}
      <div className="flex items-center gap-3">
        <div className={`size-10 rounded-sm ${avatarAccent} flex items-center justify-center font-black text-sm flex-shrink-0`}>
          {getInitials(customer.name)}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-white text-sm truncate">{customer.name}</div>
          <div className="text-[10px] text-slate-500 font-technical truncate mt-0.5">{customer.phone}</div>
        </div>
      </div>

      {/* AI Label Badge */}
      {labelCfg && (
        <div className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-sm w-fit ${labelCfg.bg} ${labelCfg.text_color}`}>
          <span>{labelCfg.emoji}</span>
          <span className="uppercase tracking-widest">{labelCfg.text}</span>
          {customer.aiConfidence > 0 && (
            <span className="opacity-50 ml-1">{Math.round(customer.aiConfidence * 100)}%</span>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="space-y-2 mt-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Revenue</span>
          <span className="font-headline font-bold text-white">{formatCurrency(customer.totalSpending)}</span>
        </div>

        {variant === 'atRisk' && customer.ghostedTimes > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Ghosted</span>
            <span className="font-headline font-bold text-red-400">{customer.ghostedTimes}×</span>
          </div>
        )}

        {variant === 'atRisk' && customer.daysSinceLastChat !== null && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Tdk Aktif</span>
            <span className={`font-headline font-bold ${customer.daysSinceLastChat > 60 ? 'text-red-400' : 'text-amber-400'}`}>
              {customer.daysSinceLastChat} hari
            </span>
          </div>
        )}

        {variant !== 'atRisk' && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Last Servis</span>
            <span className="font-headline text-slate-300">{formatDate(customer.lastService)}</span>
          </div>
        )}

        {variant === 'new' && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Join</span>
            <span className="font-headline text-slate-300">{formatDate(customer.createdAt)}</span>
          </div>
        )}
      </div>

      {/* Quick Action */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest
          border border-[#2A2A2A] bg-[#131313] w-full rounded-sm py-2 text-slate-400 mt-2
          hover:bg-emerald-950 hover:border-emerald-800 hover:text-emerald-400 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">chat</span>
        Follow Up
      </a>
    </div>
  );
}
