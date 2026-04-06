'use client';

import { useState, useEffect, useCallback } from 'react';
import { CustomerTable, Customer } from '@/components/crm/CustomerTable';
import { CustomerDetailSheet } from '@/components/crm/CustomerDetailSheet';
import { CrmStats } from '@/components/crm/CrmStats';
import { CrmFilters, SortField, SortOrder } from '@/components/crm/CrmFilters';
import { CustomerSegmentTabs } from '@/components/crm/CustomerSegmentTabs';
import { SegmentCustomer } from '@/components/crm/CustomerSegmentCard';

// ── Types ──────────────────────────────────────────────────────────────────

interface StatsData {
  total: number;
  active: number;
  new: number;
  churned: number;
  totalRevenue: number;
}

interface SegmentsData {
  vip: SegmentCustomer[];
  atRisk: SegmentCustomer[];
  new: SegmentCustomer[];
}

// ── Debounce hook ──────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<StatsData>({ total: 0, active: 0, new: 0, churned: 0, totalRevenue: 0 });
  const [segments, setSegments] = useState<SegmentsData>({ vip: [], atRisk: [], new: [] });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const debouncedSearch = useDebounce(search, 350);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/crm/stats');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error('[CRM] Stats fetch error:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchSegments = useCallback(async () => {
    setLoadingSegments(true);
    try {
      const res = await fetch('/api/crm/segments');
      const data = await res.json();
      if (data.success) setSegments(data.segments);
    } catch (err) {
      console.error('[CRM] Segments fetch error:', err);
    } finally {
      setLoadingSegments(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const params = new URLSearchParams({
        limit: '100',
        sort: sortField,
        order: sortOrder,
        ...(statusFilter && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const res = await fetch(`/api/crm/customers?${params}`);
      const data = await res.json();
      if (data.success) setCustomers(data.customers);
    } catch (err) {
      console.error('[CRM] Customers fetch error:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [debouncedSearch, statusFilter, sortField, sortOrder]);

  useEffect(() => {
    fetchStats();
    fetchSegments();
  }, [fetchStats, fetchSegments]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSort = useCallback((field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);
  }, []);

  const handleSegmentCustomerClick = useCallback((c: SegmentCustomer) => {
    setSelectedCustomer({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalSpending: c.totalSpending,
      lastService: c.lastService,
      status: (c.status as 'active' | 'churned' | 'new') || 'new',
      bikes: [],
      vehicles: [],
      aiLabel: c.aiLabel,
      aiStrategy: c.aiStrategy,
      aiConfidence: c.aiConfidence,
      ghostedTimes: c.ghostedTimes,
      daysSinceLastChat: c.daysSinceLastChat,
    });
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#131313] p-6 overflow-auto text-[#e5e2e1]">

      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-headline font-black text-white tracking-widest uppercase py-2">
            CRM <span className="text-[#FFFF00]">Overview</span>
          </h1>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => { fetchStats(); fetchSegments(); fetchCustomers(); }}
          disabled={loadingCustomers || loadingStats}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest
            px-4 py-2 border border-[#2A2A2A] bg-[#1C1B1B] text-slate-300
            hover:border-[#FFFF00] hover:text-[#FFFF00] transition-colors active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={`material-symbols-outlined text-sm ${loadingCustomers ? 'animate-spin' : ''}`}>
            refresh
          </span>
          Sync
        </button>
      </div>

      <CrmStats stats={stats} loading={loadingStats} />

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="material-symbols-outlined text-[#FFFF00] text-sm">auto_awesome</span>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#FFFF00]">
            AI Segment Insight
          </h2>
        </div>
        <CustomerSegmentTabs
          segments={segments}
          loading={loadingSegments}
          onCustomerClick={handleSegmentCustomerClick}
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="material-symbols-outlined text-slate-400 text-sm">table_rows</span>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Database
          </h2>
        </div>

        <CrmFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={handleSort}
          totalCount={customers.length}
          loading={loadingCustomers}
        />

        <CustomerTable
          customers={customers}
          onRowClick={setSelectedCustomer}
          loading={loadingCustomers}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>

      <CustomerDetailSheet
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />
    </div>
  );
}
