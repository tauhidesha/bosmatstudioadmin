'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  // Data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<StatsData>({ total: 0, active: 0, new: 0, churned: 0, totalRevenue: 0 });
  const [segments, setSegments] = useState<SegmentsData>({ vip: [], atRisk: [], new: [] });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Loading state per section
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Filter + sort state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const debouncedSearch = useDebounce(search, 350);

  // ── Fetchers ─────────────────────────────────────────────────────────────

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

  // Initial load — parallel
  useEffect(() => {
    fetchStats();
    fetchSegments();
  }, [fetchStats, fetchSegments]);

  // Re-fetch customers when filters change
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSort = useCallback((field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);
  }, []);

  const handleSegmentCustomerClick = useCallback((c: SegmentCustomer) => {
    // Map SegmentCustomer → Customer (minimal shape for detail sheet)
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-6 overflow-auto">

      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Customer Relationship
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola pelanggan, segmentasi AI, dan riwayat servis.
          </p>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => { fetchStats(); fetchSegments(); fetchCustomers(); }}
          disabled={loadingCustomers || loadingStats}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest
            px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-500
            hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={`material-symbols-outlined text-base ${loadingCustomers ? 'animate-spin' : ''}`}>
            refresh
          </span>
          Refresh
        </button>
      </div>

      {/* ① Stats Bar */}
      <CrmStats stats={stats} loading={loadingStats} />

      {/* ② Segment Tabs: VIP / At Risk / Baru */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-slate-400 text-base">auto_awesome</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Segmentasi AI
          </h2>
        </div>
        <CustomerSegmentTabs
          segments={segments}
          loading={loadingSegments}
          onCustomerClick={handleSegmentCustomerClick}
        />
      </div>

      {/* ③ All Customers Table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-slate-400 text-base">table_rows</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Semua Pelanggan
          </h2>
        </div>

        {/* Filter Bar */}
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

        {/* Table */}
        <CustomerTable
          customers={customers}
          onRowClick={setSelectedCustomer}
          loading={loadingCustomers}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>

      {/* Customer Detail Sheet */}
      <CustomerDetailSheet
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />
    </div>
  );
}
