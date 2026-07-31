'use client';

import { useState, useEffect, useRef } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { useConversationMessages } from '@/lib/hooks/useConversationMessages';
import { ApiClient } from '@/lib/api/client';
import ConversationHeader from './ConversationHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';
import FloatingBookingButton from './FloatingBookingButton';
import { toggleAiStateAction, updateConversationLabelAction, toggleFollowUpStateAction } from '@/lib/actions/conversation-actions';

interface ConversationWindowProps {
  conversation: Conversation;
  apiClient: ApiClient;
  allConversations: Conversation[];
  onBack?: () => void;
}

export default function ConversationWindow({
  conversation,
  apiClient,
  allConversations,
  onBack,
}: ConversationWindowProps) {
  const [sendingMessage, setSendingMessage] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [togglingFollowUp, setTogglingFollowUp] = useState(false);
  const [updatingLabel, setUpdatingLabel] = useState(false);

  /**
   * localConversation: optimistic overlay on top of the server-driven `conversation` prop.
   *
   * WHY: Server actions update DB → Supabase Realtime fires → hook updates state.
   * This chain takes 1-3s. Without local state, toggle appears stuck.
   *
   * HOW: After successful toggle → update localConversation immediately.
   * isOptimisticRef tracks whether we're in an optimistic state.
   * The useEffect only syncs from parent when we are NOT optimistic,
   * preventing the parent prop from overwriting our pending optimistic update.
   */
  const [localConversation, setLocalConversation] = useState<Conversation>(conversation);
  const isOptimisticRef = useRef(false);

  // Sync from parent ONLY when we are not in an optimistic state.
  // This prevents revalidatePath() or any parent re-render from
  // overwriting a toggle that the user just made.
  useEffect(() => {
    if (!isOptimisticRef.current) {
      setLocalConversation(conversation);
    }
  }, [conversation]);

  // Load messages for this conversation
  const conversationPhone = conversation.customerPhone || conversation.platformId;
  const { messages, loading: messagesLoading, addMessageLocally } = useConversationMessages({
    conversationId: conversationPhone,
    customerId: conversation.customerId,
    enabled: !!conversationPhone,
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSendMessage = async (messageText: string) => {
    setSendingMessage(true);
    try {
      const targetId = conversation.customerPhone || conversation.platformId || conversation.id;

      // Optimistic UI update
      addMessageLocally({
        id: `optimistic-${Date.now()}`,
        conversationId: conversationPhone || targetId,
        sender: 'admin',
        senderName: 'Admin',
        content: messageText,
        timestamp: Date.now(),
      });

      // Fire-and-forget: don't block the input
      apiClient.sendMessage({
        number: targetId,
        message: messageText,
        channel: conversation.channel,
        platformId: targetId,
      }).catch(err => {
        console.error('Failed to send message:', err);
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAiStateChange = async (enabled: boolean, reason?: string) => {
    setTogglingAi(true);
    isOptimisticRef.current = true;

    // Optimistic update — reflect change immediately in the header
    setLocalConversation(prev => ({
      ...prev,
      aiState: {
        enabled,
        pausedUntil: enabled ? undefined : prev.aiState?.pausedUntil,
        reason: enabled ? undefined : reason,
      },
    }));

    try {
      const targetId = conversation.customerPhone || conversation.platformId || conversation.id;
      const res = await toggleAiStateAction(targetId, enabled, reason);
      if (!res.success) {
        isOptimisticRef.current = false;
        setLocalConversation(conversation); // revert
        throw new Error(res.error);
      }
      // Success — Supabase Realtime will eventually deliver ground truth.
      // Release optimistic lock after a short delay to allow realtime to arrive.
      setTimeout(() => { isOptimisticRef.current = false; }, 3000);
    } catch (error) {
      console.error('Failed to update AI state:', error);
      isOptimisticRef.current = false;
      setLocalConversation(conversation); // revert
      throw error;
    } finally {
      setTogglingAi(false);
    }
  };

  const handleFollowUpStateChange = async (enabled: boolean) => {
    setTogglingFollowUp(true);
    isOptimisticRef.current = true;

    // Optimistic update — reflect change immediately in the header
    setLocalConversation(prev => ({
      ...prev,
      customerContext: {
        ...prev.customerContext,
        followUpStrategy: enabled ? null : 'stop',
      },
    }));

    try {
      // Always prefer customerPhone for follow-up lookup — CustomerContext is
      // indexed by phone, not by customer UUID. Passing UUID causes silent mismatch.
      const targetId = conversation.customerPhone || conversation.platformId || conversation.id;
      const res = await toggleFollowUpStateAction(targetId, enabled);
      if (!res.success) {
        isOptimisticRef.current = false;
        setLocalConversation(conversation); // revert
        throw new Error(res.error);
      }
      // Success — release optimistic lock after delay to let Supabase Realtime arrive
      setTimeout(() => { isOptimisticRef.current = false; }, 3000);
    } catch (error) {
      console.error('Failed to update Follow Up state:', error);
      isOptimisticRef.current = false;
      setLocalConversation(conversation); // revert
      throw error;
    } finally {
      setTogglingFollowUp(false);
    }
  };

  const handleLabelChange = async (label: string, reason?: string) => {
    setUpdatingLabel(true);
    isOptimisticRef.current = true;

    // Optimistic update for label
    setLocalConversation(prev => ({ ...prev, label }));

    try {
      const res = await updateConversationLabelAction(conversation.id, label, reason);
      if (!res.success) {
        isOptimisticRef.current = false;
        setLocalConversation(conversation); // revert
        throw new Error(res.error);
      }
      setTimeout(() => { isOptimisticRef.current = false; }, 3000);
    } catch (error) {
      console.error('Failed to update conversation label:', error);
      isOptimisticRef.current = false;
      setLocalConversation(conversation); // revert
      throw error;
    } finally {
      setUpdatingLabel(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#131313] relative overflow-hidden">
      {/* Header — receives localConversation for instant optimistic feedback */}
      <div className="shrink-0">
        <ConversationHeader
          conversation={localConversation}
          apiClient={apiClient}
          allConversations={allConversations}
          onAiStateChange={handleAiStateChange}
          onFollowUpStateChange={handleFollowUpStateChange}
          onLabelChange={handleLabelChange}
          onBack={onBack}
          loading={togglingAi || togglingFollowUp || updatingLabel}
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#131313]">
        <MessageList
          messages={messages}
          loading={messagesLoading}
          customerName={conversation.customerName}
          profilePic={conversation.profilePicUrl}
        />
      </div>

      {/* Floating Action Button (Mobile Only) */}
      <FloatingBookingButton
        conversation={conversation}
        apiClient={apiClient}
        allConversations={allConversations}
      />

      {/* Composer */}
      <div className="shrink-0">
        <MessageComposer
          conversation={conversation}
          onSend={handleSendMessage}
          disabled={sendingMessage}
        />
      </div>
    </div>
  );
}