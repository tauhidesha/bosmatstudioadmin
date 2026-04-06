'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { SortField, SortOrder } from './CrmFilters';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  modelName: string;
  plateNumber: string | null;
  color: string | null;
  serviceCount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  lastService: string | null;
  totalSpending: number;
  bikes: string[];
  vehicles: Vehicle[];
  status: 'active' | 'churned' | 'new';
  createdAt?: string;
  bookingCount?: number;
  // AI Classifier
  aiLabel?: string | null;
  aiStrategy?: string | null;
  aiConfidence?: number;
  ghostedTimes?: number;
  daysSinceLastChat?: number | null;
}

// ── AI Label Config ────────────────────────────────────────────────────────

const LABEL_CONFIG: Record<string, { emoji: string; bg: string; text: string }> = {
  loyal:          { emoji: '👑', bg: 'bg-[#323200] text-[#FFFF00] border-[#FFFF00]/30',   text: 'Loyal' },
  existing:       { emoji: '✅', bg: 'bg-emerald-950 text-emerald-400 border-emerald-900', text: 'Aktif' },
  hot_lead:       { emoji: '🔥', bg: 'bg-orange-950 text-orange-400 border-orange-900',  text: 'Hot' },
  warm_lead:      { emoji: '🌤️',  bg: 'bg-yellow-950 text-yellow-400 border-yellow-900', text: 'Warm' },
  window_shopper: { emoji: '👀', bg: 'bg-slate-800 text-slate-300 border-slate-700',    text: 'Looker' },
  churned:        { emoji: '⚠️', bg: 'bg-red-950 text-red-500 border-red-900',          text: 'Churn' },
  dormant_lead:   { emoji: '😴', bg: 'bg-red-950 text-red-500 border-red-900',          text: 'Dormant' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// ── Sortable Column Header ─────────────────────────────────────────────────

interface SortableHeadProps {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField, order: SortOrder) => void;
  className?: string;
}

function SortableHead({ field, label, currentSort, currentOrder, onSort, className }: SortableHeadProps) {
  const isActive = currentSort === field;

  function handleClick() {
    if (isActive) {
      onSort(field, currentOrder === 'desc' ? 'asc' : 'desc');
    } else {
      onSort(field, 'desc');
    }
  }

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-[#201f1f] hover:text-white transition-colors group ${className ?? ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1.5 uppercase text-[10px] font-bold tracking-widest text-slate-400 group-hover:text-white">
        {label}
        <span className={`material-symbols-outlined text-[10px] transition-opacity
          ${isActive ? 'opacity-100 text-[#FFFF00]' : 'opacity-0 group-hover:opacity-40'}`}
        >
          {isActive && currentOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
        </span>
      </div>
    </TableHead>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface CustomerTableProps {
  customers: Customer[];
  onRowClick: (c: Customer) => void;
  loading?: boolean;
  sortField?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField, order: SortOrder) => void;
}

function SkeletonRow() {
  return (
    <TableRow className="border-b border-[#2A2A2A] hover:bg-transparent">
      {[...Array(6)].map((_, i) => (
        <TableCell key={i} className="py-4">
          <div className="h-3 bg-[#2A2A2A] rounded-sm animate-pulse w-3/4" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function CustomerTable({
  customers,
  onRowClick,
  loading = false,
  sortField = 'updatedAt',
  sortOrder = 'desc',
  onSort,
}: CustomerTableProps) {
  return (
    <div className="border border-[#2A2A2A] bg-[#1C1B1B] overflow-hidden">
      <Table>
        <TableHeader className="bg-[#131313] border-b border-[#2A2A2A]">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead className="uppercase text-[10px] font-bold tracking-widest text-slate-400">Pelanggan</TableHead>
            <TableHead className="uppercase text-[10px] font-bold tracking-widest text-slate-400">No. HP</TableHead>
            <TableHead className="uppercase text-[10px] font-bold tracking-widest text-slate-400">Motor / Plat</TableHead>
            <TableHead className="hidden md:table-cell uppercase text-[10px] font-bold tracking-widest text-slate-400">AI Label</TableHead>
            {onSort ? (
              <SortableHead
                field="lastService"
                label="Last Service"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                className="hidden lg:table-cell"
              />
            ) : (
              <TableHead className="hidden lg:table-cell uppercase text-[10px] font-bold tracking-widest text-slate-400">Last Service</TableHead>
            )}
            {onSort ? (
              <SortableHead
                field="totalSpending"
                label="Total Revenue"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                className="text-right justify-end flex"
              />
            ) : (
              <TableHead className="text-right uppercase text-[10px] font-bold tracking-widest text-slate-400">Total Revenue</TableHead>
            )}
            <TableHead className="uppercase text-[10px] font-bold tracking-widest text-slate-400">Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
          ) : customers.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="text-center py-20 text-slate-500">
                <span className="material-symbols-outlined text-3xl block mb-2 opacity-30">
                  person_search
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest">Tidak ada record data</span>
              </TableCell>
            </TableRow>
          ) : (
            customers.map((customer) => {
              const labelCfg = customer.aiLabel ? LABEL_CONFIG[customer.aiLabel] : null;

              return (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer border-b border-[#2A2A2A] hover:bg-[#201f1f] transition-colors"
                  onClick={() => onRowClick(customer)}
                >
                  {/* Name */}
                  <TableCell className="py-4">
                    <div className="font-bold text-white text-sm">
                      {customer.name}
                    </div>
                    {(customer.bookingCount ?? 0) > 0 && (
                      <div className="text-[9px] uppercase tracking-wider font-bold text-[#FFFF00] mt-1">
                        {customer.bookingCount} Booking
                      </div>
                    )}
                  </TableCell>

                  {/* Phone */}
                  <TableCell className="text-slate-400 font-technical text-[11px]">
                    {customer.phone}
                  </TableCell>

                  {/* Vehicles */}
                  <TableCell>
                    <div className="flex flex-col gap-1.5 align-baseline">
                      {customer.vehicles.length > 0 ? (
                        customer.vehicles.map((v) => (
                          <div
                            key={v.id}
                            className="text-[10px] text-slate-300 font-medium"
                          >
                            <span className="text-white bg-[#2A2A2A] px-1.5 py-0.5 rounded-sm mr-2 font-technical tracking-wide text-[9px]">
                              {v.plateNumber || 'NOPLAT'}
                            </span>
                            {v.modelName || <span className="opacity-50">Unknown</span>}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </div>
                  </TableCell>

                  {/* AI Label */}
                  <TableCell className="hidden md:table-cell">
                    {labelCfg ? (
                      <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-sm border ${labelCfg.bg}`}>
                        <span>{labelCfg.emoji}</span>
                        <span className="uppercase tracking-widest">{labelCfg.text}</span>
                        {customer.aiConfidence && customer.aiConfidence > 0 && (
                          <span className="opacity-50 ml-0.5">{Math.round(customer.aiConfidence * 100)}%</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Last Service */}
                  <TableCell className="text-slate-400 font-technical text-[11px] hidden lg:table-cell">
                    {formatDate(customer.lastService)}
                  </TableCell>

                  {/* Total Spending */}
                  <TableCell className="text-right font-headline font-black text-white text-sm">
                    {formatCurrency(customer.totalSpending)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {customer.status === 'active' && <span className="text-[10px] px-2 py-1 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-sm font-bold uppercase tracking-widest">Active</span>}
                    {customer.status === 'new' && <span className="text-[10px] px-2 py-1 bg-sky-950 text-sky-400 border border-sky-900 rounded-sm font-bold uppercase tracking-widest">New</span>}
                    {customer.status === 'churned' && <span className="text-[10px] px-2 py-1 bg-red-950 text-red-500 border border-red-900 rounded-sm font-bold uppercase tracking-widest">Churn</span>}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
