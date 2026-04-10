'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Constants ──────────────────────────────────────────────────────────────────

const PLAYGROUND_NUMBER = 'playground-test@c.us';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  media?: { type: string; mimetype: string; base64: string; previewUrl: string }[];
  timestamp: Date;
}

interface MediaAttachment {
  type: string;
  mimetype: string;
  base64: string;
  previewUrl: string;
  fileName: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PlaygroundChat() {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'customer' | 'admin'>('customer');
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-resize textarea ───────────────────────────────────────────────────

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      const timeout = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [messages, isLoading]);

  // ── Load existing history on mount ─────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/conversation-history/${PLAYGROUND_NUMBER}?limit=50`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (data.success && data.data && data.data.length > 0) {
          const loaded: ChatMessage[] = data.data.map((msg: any, idx: number) => ({
            id: `history-${idx}`,
            role: msg.sender === 'ai' ? 'ai' : 'user',
            content: msg.text || '',
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(loaded);
        }
      } catch {
        /* ignore — fresh session */
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, []);

  // ── Image compression ─────────────────────────────────────────────────────

  const compressImage = useCallback(async (file: File, maxSize = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: MediaAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) continue;

      let base64: string;
      let mimetype = file.type;

      if (isImage) {
        base64 = await compressImage(file);
        mimetype = 'image/jpeg';
      } else {
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
      }

      const previewUrl = URL.createObjectURL(file);

      newAttachments.push({
        type: isImage ? 'image' : 'video',
        mimetype,
        base64,
        previewUrl,
        fileName: file.name,
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [compressImage]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && attachments.length === 0) || isLoading) return;

    const messageMedia = attachments.map(a => ({
      type: a.type,
      mimetype: a.mimetype,
      base64: a.base64,
      previewUrl: a.previewUrl,
    }));

    // Add user message to UI immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      media: messageMedia.length > 0 ? messageMedia : undefined,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setIsLoading(true);

    try {
      const token = await getIdToken();
      const payload: any = {
        message: trimmedInput || '(media)',
        mode,
      };

      if (messageMedia.length > 0) {
        payload.media = messageMedia.map(m => ({
          type: m.type,
          mimetype: m.mimetype,
          base64: m.base64,
        }));
      }

      const res = await fetch('/api/test-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: result.response || result.ai_response || 'Tidak ada respons.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'ai',
        content: `⚠️ Error: ${error.message || 'Gagal menghubungi server.'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Clear chat (wipe DB + LangGraph state) ────────────────────────────────

  const clearChat = async () => {
    setMessages([]);
    attachments.forEach(a => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);

    // Wipe backend data
    try {
      await fetch('/api/test-ai/clear', { method: 'DELETE' });
    } catch {
      /* ignore */
    }
  };

  // ── Format WhatsApp-style text ─────────────────────────────────────────────

  function formatMessageText(text: string) {
    if (!text) return '';
    text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
    return text;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="shrink-0 bg-white/70 backdrop-blur-xl border-b border-border/50 px-6 py-4 shadow-sm z-10 sticky top-0">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20">
              <span className="material-symbols-outlined text-white text-[20px]">smart_toy</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-slate-900 font-semibold text-base leading-tight tracking-tight">Zoya Playground</h2>
                <Badge variant="secondary" className="h-5 text-[10px] px-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200/50 uppercase tracking-wide font-bold">
                  Pipeline Aktif
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Memory Persistent Terhubung</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex items-center bg-slate-100/80 rounded-lg p-1 border border-slate-200/50">
              <button
                onClick={() => setMode('customer')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                  mode === 'customer'
                    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-900/5"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Customer
              </button>
              <button
                onClick={() => setMode('admin')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                  mode === 'admin'
                    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-900/5"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Admin
              </button>
            </div>

            {/* Clear Chat */}
            <button
              onClick={clearChat}
              className="group flex items-center justify-center p-2 rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              title="Reset Percakapan & Memory"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Subtle dot pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div 
          ref={scrollRef} 
          className="h-full overflow-y-auto px-4 md:px-8 py-6 flex flex-col"
        >
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 flex-1 justify-end">

            {/* Empty State / Welcome */}
            {messages.length === 0 && !isLoading && historyLoaded && (
              <div className="m-auto flex flex-col items-center justify-center text-center p-8 max-w-sm">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50 border border-slate-100 rotate-3 transition-transform hover:rotate-6">
                  <span className="material-symbols-outlined text-4xl text-indigo-600 outline-none block">bot</span>
                </div>
                <h4 className="text-slate-900 font-bold text-xl mb-3">Mulai Percakapan</h4>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Playground ini terhubung dengan LangGraph memori penuh. Segala konteks dan percakapan akan tersimpan secara persisten.
                </p>
                <div className="mt-6 flex gap-2 justify-center flex-wrap">
                  <Badge variant="outline" className="bg-white px-3 py-1 font-medium">{mode === 'customer' ? 'Mode Customer Aktif' : 'Mode Admin Aktif'}</Badge>
                </div>
              </div>
            )}

            {/* History loading state */}
            {!historyLoaded && (
              <div className="m-auto flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <span className="text-sm font-medium text-slate-500">Memuat memory...</span>
                </div>
              </div>
            )}

            {/* Message Bubbles */}
            {messages.map((message) => {
              const isOutgoing = message.role === 'user';

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex group w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                    isOutgoing ? "justify-end" : "justify-start"
                  )}
                >
                  {/* AI Avatar for incoming messages */}
                  {!isOutgoing && (
                    <div className="w-8 shrink-0 mr-3 hidden sm:flex flex-col justify-end">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-white text-[14px]">smart_toy</span>
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex flex-col",
                      isOutgoing ? "items-end" : "items-start",
                      "max-w-[85%] md:max-w-[70%]"
                    )}
                  >
                    {/* Media Preview in Message */}
                    {message.media && message.media.length > 0 && (
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {message.media.map((m, i) => (
                          <div key={i} className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                            {m.type === 'image' ? (
                              <img src={m.previewUrl} alt="attachment" className="max-h-56 object-cover" />
                            ) : (
                              <video src={m.previewUrl} className="max-h-56" controls playsInline />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text Bubble */}
                    {message.content && (
                      <div
                        className={cn(
                          "px-5 py-3.5 text-[15px] leading-relaxed shadow-sm transition-all",
                          isOutgoing
                            ? "bg-indigo-600 text-white rounded-3xl rounded-br-sm border border-indigo-500"
                            : "bg-white text-slate-700 rounded-3xl rounded-bl-sm border border-slate-200/60"
                        )}
                        style={{ wordBreak: 'break-word' }}
                      >
                        <div
                          className="whitespace-pre-wrap font-medium"
                          dangerouslySetInnerHTML={{ __html: formatMessageText(message.content) }}
                        />
                      </div>
                    )}

                    {/* Meta */}
                    <div className={cn(
                      "mt-1.5 flex items-center gap-2 px-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity",
                      isOutgoing ? "text-slate-400 justify-end" : "text-slate-400 justify-start"
                    )}>
                      <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isOutgoing && mode === 'admin' && (
                        <>
                          <span className="h-1 w-1 bg-slate-300 rounded-full" />
                          <span className="text-indigo-500">Zoya via Admin</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="w-8 shrink-0 mr-3 hidden sm:flex flex-col justify-end">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-white text-[14px]">smart_toy</span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl rounded-bl-sm px-5 py-4 shadow-sm flex items-center gap-1.5 h-[52px]">
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-border/50 px-4 py-4 md:py-6 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-4xl mx-auto w-full">
          <div className="relative flex flex-col items-stretch bg-white border border-slate-200/80 rounded-[20px] shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/30 transition-all duration-300 overflow-hidden">

            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
                {attachments.map((attachment, index) => (
                  <div key={index} className="relative shrink-0 group/thumb">
                    {attachment.type === 'image' ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.fileName}
                        className="h-14 w-14 object-cover rounded-xl border border-slate-200 shadow-sm"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-xl border border-slate-200 bg-white flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-indigo-500 text-[24px]">videocam</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-slate-800 text-white rounded-full flex items-center justify-center scale-0 group-hover/thumb:scale-100 transition-transform shadow-md hover:bg-slate-900"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea Wrapper */}
            <div className="relative flex items-end px-2 py-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="shrink-0 h-11 w-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors mb-1 ml-1"
                title="Attach media..."
              >
                <span className="material-symbols-outlined text-[22px]">attach_file</span>
              </button>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'admin' ? "Kirim instruksi mode admin kepada Zoya..." : "Ngobrol sebagai customer..."}
                disabled={isLoading}
                className="flex-1 min-h-[44px] max-h-[200px] border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 text-[15px] resize-none scrollbar-w-1.5 scrollbar-track-transparent scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300"
                rows={1}
              />

              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                className={cn(
                  "shrink-0 h-11 w-11 flex items-center justify-center rounded-xl transition-all mb-1 mr-1 shadow-sm",
                  isLoading || (!input.trim() && attachments.length === 0)
                    ? "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-600/20"
                )}
              >
                {isLoading ? (
                  <div className="size-4 border-2 border-indigo-400 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[20px] ml-0.5">send</span>
                )}
              </button>
            </div>
            
            {/* Minimal footer inside input box */}
            <div className="px-4 pb-2 bg-transparent flex justify-between items-center text-[10px] text-slate-400 font-medium tracking-tight">
              <span>SHIFT + ENTER untuk baris baru</span>
              <span className="uppercase text-indigo-500/70 font-semibold">{mode} MODE</span>
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
