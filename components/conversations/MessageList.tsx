/**
 * MessageList Component
 * Displays conversation messages with real-time updates
 * 
 * Requirements: 1.5, 2.8, 5.1
 */

'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/lib/hooks/useConversationMessages';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

// Helper to format WhatsApp formatting (bold, italic, strikethrough)
function formatMessageText(text: string) {
  // Replace *text* with bold
  text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  
  // Replace _text_ with italic
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Replace ~text~ with strikethrough
  text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
  
  return text;
}

export default function MessageList({ messages, loading = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-slate-500">Memuat pesan...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
            chat_bubble_outline
          </span>
          <p className="text-sm text-slate-500">Tidak ada pesan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      {messages.map((message) => {
        const isOutgoing = message.sender === 'admin' || message.sender === 'ai';
        const senderLabel =
          message.sender === 'customer'
            ? 'Customer'
            : message.sender === 'ai'
            ? 'AI'
            : 'Admin';

        const timeAgo = (() => {
          try {
            if (!message.timestamp) return 'Baru saja';
            const date = new Date(message.timestamp);
            if (isNaN(date.getTime())) return 'Baru saja';
            return formatDistanceToNow(date, {
              addSuffix: false,
              locale: idLocale,
            });
          } catch (error) {
            console.warn('Invalid timestamp in message:', message.timestamp);
            return 'Baru saja';
          }
        })();

        return (
          <div
            key={message.id}
            className={`flex ${isOutgoing ? 'flex-col items-end' : 'items-start gap-3'}`}
          >
            {!isOutgoing && (
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(senderLabel)}&background=random`}
                alt={senderLabel}
                className="w-8 h-8 rounded-full"
              />
            )}

            <div className={isOutgoing ? 'flex flex-col items-end' : ''}>
              <div
                className={`p-4 rounded-xl max-w-lg leading-relaxed text-sm ${
                  isOutgoing
                    ? 'bg-[#0a3d82] text-white rounded-br-none shadow-sm'
                    : 'bg-slate-100 text-slate-900 rounded-bl-none'
                }`}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatMessageText(message.content),
                  }}
                />
              </div>

              <div className="mt-1 text-[10px] text-slate-400">
                {senderLabel}, {timeAgo}
              </div>
            </div>
          </div>
        );
      })}

      {/* Auto-scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}
