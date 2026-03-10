/**
 * ConversationItem Component
 * Displays a single conversation in the conversation list
 * 
 * Requirements: 1.1, 1.3, 1.7, 1.8, 5.1, 5.2, 5.3
 */

'use client';

import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

const channelBadges = {
  whatsapp: { label: 'WA', color: 'bg-green-100 text-green-700' },
  instagram: { label: 'IG', color: 'bg-pink-100 text-pink-700' },
  messenger: { label: 'FB', color: 'bg-blue-100 text-blue-700' },
};

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const badge = channelBadges[conversation.channel] || { label: 'UN', color: 'bg-slate-100 text-slate-700' };
  
  // Safe date handling with fallback
  const getTimeAgo = () => {
    try {
      if (!conversation.lastMessageTime) {
        return 'Baru saja';
      }
      
      const date = new Date(conversation.lastMessageTime);
      if (isNaN(date.getTime())) {
        return 'Baru saja';
      }
      
      return formatDistanceToNow(date, {
        addSuffix: false,
        locale: idLocale,
      });
    } catch (error) {
      console.warn('Invalid date in conversation:', conversation.lastMessageTime);
      return 'Baru saja';
    }
  };

  const timeAgo = getTimeAgo();
  const aiPaused = conversation.aiState && !conversation.aiState.enabled;

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-4 cursor-pointer transition-all border-b border-slate-50 ${
        isActive
          ? 'bg-amber-50 border-l-4 border-primary'
          : 'hover:bg-slate-50'
      }`}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 font-bold text-slate-600">
        {(conversation.customerName || 'U').charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2 mb-1">
          <h3 className="font-semibold text-sm truncate text-slate-900">
            {conversation.customerName || 'Unknown User'}
          </h3>
          <span className="text-[10px] text-slate-500 uppercase shrink-0">
            {timeAgo}
          </span>
        </div>

        {/* Last message preview */}
        <p className="text-xs text-slate-600 truncate mb-2">
          {conversation.lastMessage || 'No messages yet'}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-2">
          {/* Channel badge */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>

          {/* AI paused badge */}
          {aiPaused && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
              AI Dijeda
            </span>
          )}

          {/* Unread badge */}
          {conversation.unreadCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-primary text-zinc-950">
              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
            </span>
          )}

          {/* Label badge */}
          {conversation.label && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
              {conversation.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
