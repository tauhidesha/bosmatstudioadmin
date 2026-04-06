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
    label: 'Total Pelanggan',
    icon: 'group',
    color: 'text-slate-700',
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-slate-400',
    format: 'number',
  },
  {
    key: 'active' as const,
    label: 'Aktif',
    icon: 'verified_user',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-400',
    format: 'number',
  },
  {
    key: 'new' as const,
    label: 'Baru (30 hari)',
    icon: 'person_add',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconColor: 'text-sky-400',
    format: 'number',
  },
  {
    key: 'churned' as const,
    label: 'Churn Risk',
    icon: 'person_off',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-400',
    format: 'number',
  },
  {
    key: 'totalRevenue' as const,
    label: 'Total Revenue',
    icon: 'payments',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-400',
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {STAT_ITEMS.map((item) => (
        <div
          key={item.key}
          className={`${item.bg} ${item.border} border rounded-xl p-4 flex flex-col gap-2 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${item.color} opacity-70`}>
              {item.label}
            </span>
            <span className={`material-symbols-outlined text-base ${item.iconColor}`}>
              {item.icon}
            </span>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className={`text-2xl font-black tracking-tight ${item.color}`}>
              {formatValue(stats[item.key], item.format)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
