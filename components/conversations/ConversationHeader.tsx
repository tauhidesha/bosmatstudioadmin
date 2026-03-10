/**
 * ConversationHeader Component
 * Displays customer info, AI state controls, and conversation labeling
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.7, 3.8, 18.1, 18.2, 18.3, 18.5, 18.6, 18.8
 */

'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ConversationHeaderProps {
  conversation: Conversation;
  onAiStateChange: (enabled: boolean, reason?: string) => Promise<void>;
  onLabelChange: (label: string, reason?: string) => Promise<void>;
  loading?: boolean;
}

const channelBadges = {
  whatsapp: { label: 'WA', color: 'bg-green-100 text-green-700' },
  instagram: { label: 'IG', color: 'bg-pink-100 text-pink-700' },
  messenger: { label: 'FB', color: 'bg-blue-100 text-blue-700' },
};

const CONVERSATION_LABELS = [
  { value: 'hot_lead', label: 'Hot Lead', color: 'bg-red-100 text-red-700' },
  { value: 'cold_lead', label: 'Cold Lead', color: 'bg-blue-100 text-blue-700' },
  { value: 'booking_process', label: 'Proses Booking', color: 'bg-orange-100 text-orange-700' },
  { value: 'scheduling', label: 'Penjadwalan', color: 'bg-purple-100 text-purple-700' },
  { value: 'completed', label: 'Selesai', color: 'bg-green-100 text-green-700' },
  { value: 'follow_up', label: 'Follow-up', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'general', label: 'Umum', color: 'bg-slate-100 text-slate-700' },
  { value: 'archive', label: 'Arsip', color: 'bg-slate-100 text-slate-500' },
];

export default function ConversationHeader({
  conversation,
  onAiStateChange,
  onLabelChange,
  loading = false,
}: ConversationHeaderProps) {
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [showAiPauseInfo, setShowAiPauseInfo] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(conversation.label || '');
  const [labelReason, setLabelReason] = useState('');
  const [isUpdatingLabel, setIsUpdatingLabel] = useState(false);

  const badge = channelBadges[conversation.channel] || { label: 'UN', color: 'bg-slate-100 text-slate-700' };
  const aiEnabled = conversation.aiState?.enabled ?? true;
  const aiPausedUntil = conversation.aiState?.pausedUntil;
  const aiPauseReason = conversation.aiState?.reason;
  
  const currentLabel = CONVERSATION_LABELS.find(l => l.value === conversation.label);

  const handleAiToggle = async () => {
    setIsTogglingAi(true);
    try {
      const newState = !aiEnabled;
      const reason = newState ? undefined : 'Manual pause by admin';
      await onAiStateChange(newState, reason);
    } catch (error) {
      console.error('Failed to toggle AI state:', error);
    } finally {
      setIsTogglingAi(false);
    }
  };

  const handleLabelUpdate = async () => {
    if (!selectedLabel) return;
    
    setIsUpdatingLabel(true);
    try {
      await onLabelChange(selectedLabel, labelReason || undefined);
      setShowLabelModal(false);
      setLabelReason('');
    } catch (error) {
      console.error('Failed to update label:', error);
    } finally {
      setIsUpdatingLabel(false);
    }
  };

  const openLabelModal = () => {
    setSelectedLabel(conversation.label || '');
    setLabelReason('');
    setShowLabelModal(true);
  };

  const getAiStatusText = () => {
    if (aiEnabled) {
      return 'AI Aktif';
    }

    if (aiPausedUntil) {
      const timeRemaining = formatDistanceToNow(new Date(aiPausedUntil), {
        addSuffix: true,
        locale: idLocale,
      });
      return `AI Dijeda ${timeRemaining}`;
    }

    return 'AI Dijeda';
  };

  return (
    <>
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-white">
        {/* Left side - Customer info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
            {(conversation.customerName || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-sm text-slate-900">
              {conversation.customerName || 'Unknown User'}
            </h3>
            <p className="text-xs text-slate-500">{conversation.customerPhone || 'No phone'}</p>
          </div>

          {/* Channel badge */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>

          {/* Label badge */}
          {currentLabel && (
            <button
              onClick={openLabelModal}
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity ${currentLabel.color}`}
            >
              {currentLabel.label}
            </button>
          )}
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-3">
          {/* Label dropdown button */}
          <button
            onClick={openLabelModal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            title="Update label"
          >
            <span className="material-symbols-outlined text-sm">label</span>
            Label
          </button>

          {/* AI Status */}
          <div className="relative">
            <button
              onClick={() => setShowAiPauseInfo(!showAiPauseInfo)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                aiEnabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {aiEnabled ? 'smart_toy' : 'pause_circle'}
              </span>
              {getAiStatusText()}
            </button>

            {/* AI Pause Info Tooltip */}
            {showAiPauseInfo && !aiEnabled && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 z-10">
                <p className="text-xs font-semibold text-slate-900 mb-2">
                  Informasi Jeda AI
                </p>
                {aiPausedUntil && (
                  <p className="text-xs text-slate-600 mb-1">
                    <strong>Hingga:</strong> {new Date(aiPausedUntil).toLocaleString('id-ID')}
                  </p>
                )}
                {aiPauseReason && (
                  <p className="text-xs text-slate-600">
                    <strong>Alasan:</strong> {aiPauseReason}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AI Toggle Button */}
          <Button
            onClick={handleAiToggle}
            disabled={isTogglingAi || loading}
            isLoading={isTogglingAi}
            variant={aiEnabled ? 'danger' : 'success'}
            size="sm"
            className="text-xs"
          >
            {aiEnabled ? 'Jeda AI' : 'Lanjutkan AI'}
          </Button>

          {/* More options */}
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>

      {/* Label Update Modal */}
      <Modal
        isOpen={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        title="Update Conversation Label"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Label
            </label>
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">No Label</option>
              {CONVERSATION_LABELS.map((label) => (
                <option key={label.value} value={label.value}>
                  {label.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={labelReason}
              onChange={(e) => setLabelReason(e.target.value)}
              placeholder="Why are you changing this label?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => setShowLabelModal(false)}
              variant="secondary"
              disabled={isUpdatingLabel}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLabelUpdate}
              variant="primary"
              isLoading={isUpdatingLabel}
              disabled={!selectedLabel}
            >
              Update Label
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
