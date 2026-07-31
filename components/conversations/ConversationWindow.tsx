'use client';

import { useState, useEffect } from 'react';
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
   * WHY: Server actions (toggleAiStateAction, toggleFollowUpStateAction) update the DB,
   * then Supabase Realtime fires an event, then the hook refetches — this chain can take
   * 1-3 seconds. Without this local state the toggle button appears stuck.
   *
   * HOW: After a successful toggle we immediately update localConversation.
   * When the parent eventually pushes a fresh `conversation` prop (from Realtime),
   * the useEffect below syncs localConversation back to ground truth.
   */
  const [localConversation, setLocalConversation] = useState<Conversation>(conversation);

  // Sync whenever the parent receives a fresh conversation from Supabase Realtime
  useEffect(() => {
    setLocalConversation(conversation);
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
        // Revert optimistic update on failure
        setLocalConversation(conversation);
        throw new Error(res.error);
      }
    } catch (error) {
      console.error('Failed to update AI state:', error);
      setLocalConversation(conversation); // revert
      throw error;
    } finally {
      setTogglingAi(false);
    }
  };

  const handleFollowUpStateChange = async (enabled: boolean) => {
    setTogglingFollowUp(true);

    // Optimistic update — reflect change immediately in the header
    setLocalConversation(prev => ({
      ...prev,
      customerContext: {
        ...prev.customerContext,
        followUpStrategy: enabled ? null : 'stop',
      },
    }));

    try {
      const targetId = conversation.id || conversation.customerPhone || conversation.platformId;
      const res = await toggleFollowUpStateAction(targetId, enabled);
      if (!res.success) {
        // Revert optimistic update on failure
        setLocalConversation(conversation);
        throw new Error(res.error);
      }
    } catch (error) {
      console.error('Failed to update Follow Up state:', error);
      setLocalConversation(conversation); // revert
      throw error;
    } finally {
      setTogglingFollowUp(false);
    }
  };

  const handleLabelChange = async (label: string, reason?: string) => {
    setUpdatingLabel(true);

    // Optimistic update for label
    setLocalConversation(prev => ({ ...prev, label }));

    try {
      const res = await updateConversationLabelAction(conversation.id, label, reason);
      if (!res.success) {
        setLocalConversation(conversation);
        throw new Error(res.error);
      }
    } catch (error) {
      console.error('Failed to update conversation label:', error);
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