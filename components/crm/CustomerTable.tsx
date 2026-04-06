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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  loyal:          { emoji: '👑', bg: 'bg-amber-100 text-amber-800 border-amber-200',   text: 'Loyal' },
  existing:       { emoji: '✅', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'Aktif' },
  hot_lead:       { emoji: '🔥', bg: 'bg-orange-100 text-orange-800 border-orange-200',  text: 'Hot' },
  warm_lead:      { emoji: '🌤️',  bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Warm' },
  window_shopper: { emoji: '👀', bg: 'bg-slate-100 text-slate-600 border-slate-200',    text: 'Looker' },
  churned:        { emoji: '⚠️', bg: 'bg-red-100 text-red-700 border-red-200',          text: 'Churn' },
  dormant_lead:   { emoji: '😴', bg: 'bg-red-100 text-red-700 border-red-200',          text: 'Dormant' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
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
      className={`cursor-pointer select-none hover:bg-slate-100 transition-colors group ${className ?? ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`material-symbols-outlined text-sm transition-opacity
          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
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
    <TableRow>
      {[...Array(6)].map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead>Pelanggan</TableHead>
            <TableHead>No. HP</TableHead>
            <TableHead>Motor / Plat</TableHead>
            <TableHead className="hidden md:table-cell">AI Label</TableHead>
            {onSort ? (
              <SortableHead
                field="lastService"
                label="Terakhir Servis"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                className="hidden lg:table-cell"
              />
            ) : (
              <TableHead className="hidden lg:table-cell">Terakhir Servis</TableHead>
            )}
            {onSort ? (
              <SortableHead
                field="totalSpending"
                label="Total Transaksi"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                className="text-right"
              />
            ) : (
              <TableHead className="text-right">Total Transaksi</TableHead>
            )}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
          ) : customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">
                  person_search
                </span>
                Tidak ada pelanggan ditemukan
              </TableCell>
            </TableRow>
          ) : (
            customers.map((customer) => {
              const labelCfg = customer.aiLabel ? LABEL_CONFIG[customer.aiLabel] : null;

              return (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => onRowClick(customer)}
                >
                  {/* Name */}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-black">
                          {customer.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">
                          {customer.name}
                        </div>
                        {(customer.bookingCount ?? 0) > 0 && (
                          <div className="text-[10px] text-slate-400">
                            {customer.bookingCount} booking
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Phone */}
                  <TableCell className="text-slate-500 font-mono text-xs">
                    {customer.phone}
                  </TableCell>

                  {/* Vehicles */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {customer.vehicles.length > 0 ? (
                        customer.vehicles.map((v) => (
                          <Badge
                            key={v.id}
                            variant="outline"
                            className="text-[10px] font-normal"
                            title={`${v.serviceCount}× servis`}
                          >
                            {v.plateNumber ? (
                              <>
                                <span className="font-mono font-semibold">{v.plateNumber}</span>
                                {v.modelName && (
                                  <span className="ml-1 text-slate-400">({v.modelName})</span>
                                )}
                              </>
                            ) : (
                              v.modelName
                            )}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </div>
                  </TableCell>

                  {/* AI Label */}
                  <TableCell className="hidden md:table-cell">
                    {labelCfg ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${labelCfg.bg}`}>
                        <span>{labelCfg.emoji}</span>
                        <span className="uppercase tracking-wide">{labelCfg.text}</span>
                        {customer.aiConfidence && customer.aiConfidence > 0 && (
                          <span className="opacity-50">{Math.round(customer.aiConfidence * 100)}%</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Last Service */}
                  <TableCell className="text-slate-500 text-sm hidden lg:table-cell">
                    {formatDate(customer.lastService)}
                  </TableCell>

                  {/* Total Spending */}
                  <TableCell className="text-right font-bold text-slate-700">
                    {formatCurrency(customer.totalSpending)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant={
                        customer.status === 'active' ? 'default' :
                        customer.status === 'new' ? 'secondary' : 'destructive'
                      }
                      className="text-xs capitalize"
                    >
                      {customer.status}
                    </Badge>
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
