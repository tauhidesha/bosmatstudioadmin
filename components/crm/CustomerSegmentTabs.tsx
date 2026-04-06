'use client';

import { useState } from 'react';
import { CustomerSegmentCard, SegmentCustomer } from './CustomerSegmentCard';

interface SegmentsData {
  vip: SegmentCustomer[];
  atRisk: SegmentCustomer[];
  new: SegmentCustomer[];
}

interface CustomerSegmentTabsProps {
  segments: SegmentsData;
  loading?: boolean;
  onCustomerClick: (c: SegmentCustomer) => void;
}

const TABS = [
  {
    key: 'vip' as const,
    label: 'VIP',
    emoji: '👑',
    emptyMsg: 'Belum ada pelanggan loyal',
    borderActive: 'border-amber-400 text-amber-700',
    bg: 'bg-amber-50',
  },
  {
    key: 'atRisk' as const,
    label: 'Churn Risk',
    emoji: '⚠️',
    emptyMsg: 'Semua pelanggan aman',
    borderActive: 'border-red-400 text-red-700',
    bg: 'bg-red-50',
  },
  {
    key: 'new' as const,
    label: 'Baru',
    emoji: '🆕',
    emptyMsg: 'Belum ada pelanggan baru bulan ini',
    borderActive: 'border-sky-400 text-sky-700',
    bg: 'bg-sky-50',
  },
] as const;

function SkeletonCard() {
  return (
    <div className="min-w-[220px] max-w-[260px] flex-shrink-0 bg-white border border-slate-100 rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-slate-100 rounded w-3/4" />
          <div className="h-2.5 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="h-5 bg-slate-100 rounded w-24" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
      </div>
      <div className="h-7 bg-slate-100 rounded-lg" />
    </div>
  );
}

export function CustomerSegmentTabs({ segments, loading, onCustomerClick }: CustomerSegmentTabsProps) {
  const [activeTab, setActiveTab] = useState<'vip' | 'atRisk' | 'new'>('vip');

  const activeConfig = TABS.find((t) => t.key === activeTab)!;
  const activeData = segments[activeTab];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
      {/* Tab Header */}
      <div className="flex border-b border-slate-100">
        {TABS.map((tab) => {
          const count = segments[tab.key].length;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all duration-150
                ${isActive
                  ? `${tab.borderActive} border-current bg-white`
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              {!loading && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  ${isActive ? tab.bg : 'bg-slate-100 text-slate-500'}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Cards Scroll Area */}
      <div className="p-4">
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : activeData.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {activeData.map((customer) => (
              <CustomerSegmentCard
                key={customer.id}
                customer={customer}
                variant={activeTab}
                onClick={onCustomerClick}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">
              {activeTab === 'vip' ? 'star' : activeTab === 'atRisk' ? 'verified' : 'person_add'}
            </span>
            <p className="text-sm font-medium">{activeConfig.emptyMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
