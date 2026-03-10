/**
 * ConversationList Component
 * Displays list of conversations with search and label filtering
 * 
 * Requirements: 1.1, 1.3, 1.7, 1.8, 5.1, 5.2, 5.3
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import ConversationItem from './ConversationItem';
import Input from '@/components/shared/Input';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  loading?: boolean;
}

const LABELS = [
  { value: '', label: 'Semua label' },
  { value: 'hot_lead', label: 'Hot Lead' },
  { value: 'cold_lead', label: 'Cold Lead' },
  { value: 'booking_process', label: 'Proses Booking' },
  { value: 'scheduling', label: 'Penjadwalan' },
  { value: 'completed', label: 'Selesai' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'general', label: 'Umum' },
  { value: 'archive', label: 'Arsip' },
];

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading = false,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Clear existing timeout
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value.toLowerCase());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, []);

  // Filter conversations based on search and label
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Label filter
      if (selectedLabel && conv.label !== selectedLabel) {
        return false;
      }

      // Search filter - search by name, phone, or message content
      if (debouncedSearch) {
        const searchLower = debouncedSearch;
        return (
          conv.customerName.toLowerCase().includes(searchLower) ||
          conv.customerPhone.toLowerCase().includes(searchLower) ||
          conv.lastMessage.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [conversations, selectedLabel, debouncedSearch]);

  return (
    <div className="w-full md:w-1/3 border-r flex flex-col h-full bg-white">
      {/* Search and Filter Section */}
      <div className="p-4 space-y-3 border-b">
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="material-symbols-outlined text-slate-400 text-lg">
              search
            </span>
          </span>
          <input
            type="text"
            placeholder="Cari nama, nomor, atau pesan"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Label Filter Dropdown */}
        <select
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value)}
          className="w-full pl-3 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white cursor-pointer"
        >
          {LABELS.map((label) => (
            <option key={label.value} value={label.value}>
              {label.label}
            </option>
          ))}
        </select>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-slate-500">Memuat percakapan...</p>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                chat_bubble_outline
              </span>
              <p className="text-sm text-slate-500">
                {debouncedSearch || selectedLabel
                  ? 'Tidak ada percakapan yang cocok'
                  : 'Tidak ada percakapan'}
              </p>
            </div>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={selectedId === conversation.id}
              onClick={() => onSelect(conversation)}
            />
          ))
        )}
      </div>
    </div>
  );
}
