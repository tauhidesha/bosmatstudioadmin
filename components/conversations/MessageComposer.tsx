/**
 * MessageComposer Component
 * Multi-line textarea with auto-expand and send functionality
 * 
 * Requirements: 2.1, 2.2, 2.4, 2.7, 2.9
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import Button from '@/components/shared/Button';

interface MessageComposerProps {
  conversation: Conversation;
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

const channelLabels = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

export default function MessageComposer({
  conversation,
  onSend,
  disabled = false,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Allow Shift+Enter for new line
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await onSend(message);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border-t bg-white">
      {/* Channel Indicator */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">
          Saluran:
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
          {channelLabels[conversation.channel]}
        </span>
      </div>

      {/* Message Input */}
      <div className="flex items-end gap-2 border border-slate-200 rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pesan... (Shift+Enter untuk baris baru)"
          disabled={disabled || isLoading}
          className="flex-1 border-none focus:ring-0 text-sm py-2 px-2 resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          rows={1}
          style={{ maxHeight: '120px' }}
        />

        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isLoading}
          isLoading={isLoading}
          variant="primary"
          size="md"
          className="shrink-0"
        >
          <span className="material-symbols-outlined text-lg transform -rotate-90">
            send
          </span>
        </Button>
      </div>

      {/* Helper text */}
      <p className="mt-2 text-[10px] text-slate-400">
        Tekan Enter untuk mengirim, Shift+Enter untuk baris baru
      </p>
    </div>
  );
}
