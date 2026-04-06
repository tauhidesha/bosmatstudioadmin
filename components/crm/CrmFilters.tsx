'use client';

import { useCallback } from 'react';

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
  { value: '', label: 'STATUS: SEMUA' },
  { value: 'active', label: 'STATUS: AKTIF' },
  { value: 'new', label: 'STATUS: BARU' },
  { value: 'churned', label: 'STATUS: CHURNED' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'SORT: TERBARU DIUPDATE' },
  { value: 'totalSpending', label: 'SORT: HIGHEST REVENUE' },
  { value: 'lastService', label: 'SORT: TERAKHIR SERVIS' },
  { value: 'createdAt', label: 'SORT: TERBARU JOIN' },
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
    <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center bg-[#1C1B1B] p-3 border border-[#2A2A2A]">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama atau nomor HP..."
          className="w-full pl-9 pr-4 py-2 text-xs font-technical bg-[#131313] border border-[#2A2A2A] rounded-sm 
            focus:outline-none focus:border-[#FFFF00] text-white
            placeholder:text-slate-600 transition-colors"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>

      {/* Selectors Wrapper for mobile wrap */}
      <div className="flex gap-2 w-full sm:w-auto">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase bg-[#131313] 
            border border-[#2A2A2A] rounded-sm focus:outline-none focus:border-[#FFFF00]
            text-slate-300 cursor-pointer transition-colors flex-1 sm:flex-none appearance-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Sort Field */}
        <select
          value={sortField}
          onChange={(e) => onSortChange(e.target.value as SortField, sortOrder)}
          className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase bg-[#131313] 
            border border-[#2A2A2A] rounded-sm focus:outline-none focus:border-[#FFFF00]
            text-slate-300 cursor-pointer transition-colors flex-1 sm:flex-none appearance-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Sort Order Toggle */}
        <button
          onClick={toggleOrder}
          title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
          className="px-3 py-2 bg-[#131313] border border-[#2A2A2A] rounded-sm hover:border-[#FFFF00] 
            text-slate-400 hover:text-[#FFFF00] transition-colors flex-shrink-0 flex items-center"
        >
          <span className="material-symbols-outlined text-sm">
            {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
          </span>
        </button>
      </div>

      {/* Count Chip */}
      <div className="text-[10px] tracking-widest uppercase font-black text-[#FFFF00] whitespace-nowrap ml-auto hidden md:block">
        {loading ? 'SYNCING...' : `${totalCount} DATA`}
      </div>
    </div>
  );
}
