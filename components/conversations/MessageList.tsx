'use client';

import { useEffect, useRef, useState } from 'react';
import { Message } from '@/lib/hooks/useConversationMessages';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLayout } from '@/context/LayoutContext';
import { useScrollDirection } from '@/lib/hooks/useScrollDirection';

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

// Helper to format WhatsApp formatting (bold, italic, strikethrough)
function formatMessageText(text: string) {
  if (!text) return '';
  // Replace *text* with bold
  text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  // Replace _text_ with italic
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Replace ~text~ with strikethrough
  text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
  return text;
}

export default function MessageList({ messages, loading = false }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setIsHeaderVisible } = useLayout();
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const { scrollDirection, isAtTop, isAtBottom } = useScrollDirection(viewport);

  useEffect(() => {
    if (scrollRef.current) {
      const v = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      setViewport(v);
    }
  }, []);

  // Handle auto-hide header on mobile
  useEffect(() => {
    if (!viewport) return;
    
    if (isAtTop || isAtBottom) {
      setIsHeaderVisible(true);
    } else if (scrollDirection === 'down') {
      setIsHeaderVisible(false);
    } else if (scrollDirection === 'up') {
      setIsHeaderVisible(true);
    }
  }, [scrollDirection, setIsHeaderVisible, viewport, isAtTop, isAtBottom]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (viewport) {
      // Small delay to ensure content is rendered
      const timeout = setTimeout(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [messages, viewport]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50/30">
        <div className="text-center">
          <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">Memuat riwayat pesan...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50/50">
        <div className="text-center p-8 max-w-xs">
          <div className="size-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-slate-200/50 mb-8 border border-slate-50">
            <span className="material-symbols-outlined text-6xl text-slate-100">forum</span>
          </div>
          <h4 className="text-slate-900 font-black text-lg mb-2">Pintu Terbuka!</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Belum ada pesan di sini. Jadilah yang pertama menyapa pelanggan Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea
      ref={scrollRef}
      className="h-full w-full bg-[#fbfbfb]"
    >
      {/* Subtle Background Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />

      <div className="px-3 md:px-8 py-4 md:py-8 space-y-3 flex flex-col min-h-full">
        {/* Spacer to push content down if not full */}
        <div className="flex-1" />

        {messages.map((message, idx) => {
          const isOutgoing = message.sender === 'admin' || message.sender === 'ai';
          const senderLabel =
            message.sender === 'customer'
              ? 'Customer'
              : message.sender === 'ai'
                ? 'AI Assistant'
                : 'Admin';

          const timeAgo = (() => {
            try {
              if (!message.timestamp) return 'Baru saja';
              const date = new Date(message.timestamp);
              if (isNaN(date.getTime())) return 'Baru saja';
              return formatDistanceToNow(date, { addSuffix: false, locale: idLocale });
            } catch (error) {
              return 'Baru saja';
            }
          })();

          const showAvatar = !isOutgoing && (idx === 0 || messages[idx - 1].sender !== message.sender);

          return (
            <div
              key={message.id}
              className={cn(
                "flex group animate-in fade-in slide-in-from-bottom-4 duration-500",
                isOutgoing ? "justify-end" : "justify-start"
              )}
            >
              {!isOutgoing && (
                <div className="w-10 mr-3 shrink-0 flex flex-col justify-end">
                  {showAvatar ? (
                    <div className="w-9 h-9 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-md font-black text-slate-300 text-[10px]">
                      {(senderLabel).charAt(0)}
                    </div>
                  ) : <div className="w-9" />}
                </div>
              )}

              <div className={cn(
                "flex flex-col max-w-[70%] md:max-w-[70%]",
                isOutgoing ? "items-end" : "items-start"
              )}>
                <div
                  className={cn(
                    "px-4 py-3 rounded-2xl leading-relaxed text-[15px] relative transition-all duration-300",
                    isOutgoing
                      ? "bg-slate-800 text-slate-50 font-medium rounded-tr-sm shadow-sm"
                      : "bg-white text-slate-700 rounded-tl-sm border border-slate-200 shadow-sm"
                  )}
                >
                  <div
                    className="whitespace-pre-wrap break-words select-text selection:bg-primary selection:text-zinc-950 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: formatMessageText(message.content) }}
                  ></div>
                </div>

                <div className={cn(
                  "mt-2.5 flex items-center gap-2.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  isOutgoing ? "flex-row-reverse" : ""
                )}>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {senderLabel}
                  </span>
                  <span className="size-1 bg-slate-200 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase">
                    {timeAgo}
                  </span>
                  {isOutgoing && message.sender === 'ai' && (
                    <Badge variant="outline" className="h-3.5 ml-1 px-1.5 py-0 text-[9px] border-primary/30 text-primary-foreground bg-primary/10 uppercase font-black tracking-tighter shadow-none">
                      AUTO-RESPONSE
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
