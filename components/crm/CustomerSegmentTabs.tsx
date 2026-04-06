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
    activeClass: 'border-[#FFFF00] text-[#FFFF00] bg-[#1C1B1B]',
    countClass: 'bg-[#323200] text-[#FFFF00]',
  },
  {
    key: 'atRisk' as const,
    label: 'Churn Risk',
    emoji: '⚠️',
    emptyMsg: 'Semua pelanggan aman',
    activeClass: 'border-red-500 text-red-500 bg-[#1C1B1B]',
    countClass: 'bg-red-950 text-red-400',
  },
  {
    key: 'new' as const,
    label: 'Baru',
    emoji: '🆕',
    emptyMsg: 'Belum ada pelanggan baru bulan ini',
    activeClass: 'border-sky-500 text-sky-500 bg-[#1C1B1B]',
    countClass: 'bg-sky-950 text-sky-400',
  },
] as const;

function SkeletonCard() {
  return (
    <div className="min-w-[220px] max-w-[260px] flex-shrink-0 bg-[#1C1B1B] border border-[#2A2A2A] rounded-sm p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-sm bg-[#2A2A2A]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-[#2A2A2A] rounded-sm w-3/4" />
          <div className="h-2.5 bg-[#2A2A2A] rounded-sm w-1/2" />
        </div>
      </div>
      <div className="h-5 bg-[#2A2A2A] rounded-sm w-24" />
      <div className="space-y-2">
        <div className="h-3 bg-[#2A2A2A] rounded-sm w-full" />
        <div className="h-3 bg-[#2A2A2A] rounded-sm w-4/5" />
      </div>
      <div className="h-7 bg-[#2A2A2A] rounded-sm mt-3" />
    </div>
  );
}

export function CustomerSegmentTabs({ segments, loading, onCustomerClick }: CustomerSegmentTabsProps) {
  const [activeTab, setActiveTab] = useState<'vip' | 'atRisk' | 'new'>('vip');

  const activeConfig = TABS.find((t) => t.key === activeTab)!;
  const activeData = segments[activeTab];

  return (
    <div className="border border-[#2A2A2A] bg-[#131313] mb-8">
      {/* Tab Header */}
      <div className="flex border-b border-[#2A2A2A] bg-[#1C1B1B]">
        {TABS.map((tab) => {
          const count = segments[tab.key].length;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all duration-150 relative
                ${isActive
                  ? `${tab.activeClass}`
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#201f1f]'
                }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              {!loading && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-black tracking-tighter
                  ${isActive ? tab.countClass : 'bg-[#2A2A2A] text-slate-500'}`}
                >
                  {count}
                </span>
              )}
              {isActive && (
                <div className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-current" />
              )}
            </button>
          );
        })}
      </div>

      {/* Cards Scroll Area */}
      <div className="p-5 bg-gradient-to-b from-[#181818] to-[#131313]">
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : activeData.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
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
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-3 opacity-20">
              {activeTab === 'vip' ? 'star' : activeTab === 'atRisk' ? 'verified' : 'person_add'}
            </span>
            <p className="text-[10px] uppercase font-bold tracking-widest">{activeConfig.emptyMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
