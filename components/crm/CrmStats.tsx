'use client';

interface CrmStatsProps {
  stats: {
    total: number;
    active: number;
    new: number;
    churned: number;
    totalRevenue: number;
  };
  loading?: boolean;
}

const STAT_ITEMS = [
  {
    key: 'total' as const,
    label: 'Total DB',
    icon: 'database',
    color: 'text-white',
    bg: 'bg-[#1C1B1B]',
    border: 'border-[#2A2A2A]',
    iconColor: 'text-slate-500',
    format: 'number',
  },
  {
    key: 'active' as const,
    label: 'Aktif',
    icon: 'radio_button_checked',
    color: 'text-emerald-400',
    bg: 'bg-[#1C1B1B]',
    border: 'border-[#2A2A2A]',
    iconColor: 'text-emerald-900',
    format: 'number',
  },
  {
    key: 'new' as const,
    label: 'Baru (30h)',
    icon: 'group_add',
    color: 'text-sky-400',
    bg: 'bg-[#1C1B1B]',
    border: 'border-[#2A2A2A]',
    iconColor: 'text-sky-900',
    format: 'number',
  },
  {
    key: 'churned' as const,
    label: 'Churn Risk',
    icon: 'warning',
    color: 'text-red-400',
    bg: 'bg-[#1C1B1B]',
    border: 'border-[#2A2A2A]',
    iconColor: 'text-red-900',
    format: 'number',
  },
  {
    key: 'totalRevenue' as const,
    label: 'Total Revenue',
    icon: 'account_balance_wallet',
    color: 'text-[#FFFF00]',
    bg: 'bg-[#1C1B1B]',
    border: 'border-[#2A2A2A]',
    iconColor: 'text-[#686800]',
    format: 'currency',
  },
];

function formatValue(value: number, format: string) {
  if (format === 'currency') {
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
    return `Rp ${value.toLocaleString('id-ID')}`;
  }
  return value.toLocaleString('id-ID');
}

export function CrmStats({ stats, loading }: CrmStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0.5 bg-[#2A2A2A] border border-[#2A2A2A] mb-8">
      {STAT_ITEMS.map((item) => (
        <div
          key={item.key}
          className={`${item.bg} p-5 flex flex-col gap-3 transition-colors hover:bg-[#201f1f]`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-bold uppercase tracking-widest text-slate-400`}>
              {item.label}
            </span>
            <span className={`material-symbols-outlined text-sm ${item.iconColor}`}>
              {item.icon}
            </span>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-[#2A2A2A] rounded-sm animate-pulse" />
          ) : (
            <div className={`text-2xl font-headline font-black tracking-tight ${item.color}`}>
              {formatValue(stats[item.key], item.format)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
