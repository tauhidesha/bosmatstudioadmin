'use client';

import { useState, useCallback } from 'react';

export type SortField = 'totalSpending' | 'lastService' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

interface CrmFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  totalCount: number;
  loading?: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'active', label: '✅ Aktif' },
  { value: 'new', label: '🆕 Baru' },
  { value: 'churned', label: '⚠️ Churned' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Terbaru diupdate' },
  { value: 'totalSpending', label: 'Tertinggi revenue' },
  { value: 'lastService', label: 'Terakhir servis' },
  { value: 'createdAt', label: 'Terbaru bergabung' },
];

export function CrmFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortField,
  sortOrder,
  onSortChange,
  totalCount,
  loading,
}: CrmFiltersProps) {
  const toggleOrder = useCallback(() => {
    onSortChange(sortField, sortOrder === 'desc' ? 'asc' : 'desc');
  }, [sortField, sortOrder, onSortChange]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama atau nomor HP…"
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg 
            focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400 
            placeholder:text-slate-400 transition-all"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400
          text-slate-700 cursor-pointer transition-all"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Sort Field */}
      <select
        value={sortField}
        onChange={(e) => onSortChange(e.target.value as SortField, sortOrder)}
        className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400
          text-slate-700 cursor-pointer transition-all"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Sort Order Toggle */}
      <button
        onClick={toggleOrder}
        title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
        className="p-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 
          text-slate-500 hover:text-slate-700 transition-all"
      >
        <span className="material-symbols-outlined text-lg">
          {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
        </span>
      </button>

      {/* Count Chip */}
      <div className="text-xs font-bold text-slate-400 whitespace-nowrap ml-auto hidden sm:block">
        {loading ? '…' : `${totalCount} pelanggan`}
      </div>
    </div>
  );
}
