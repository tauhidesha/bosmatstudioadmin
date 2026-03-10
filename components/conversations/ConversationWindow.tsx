/**
 * ConversationWindow Component
 * Main conversation view with header, messages, and composer
 * 
 * Requirements: 1.5, 2.1, 2.3, 3.1, 3.3, 18.1, 18.2, 18.3
 */

'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { useConversationMessages } from '@/lib/hooks/useConversationMessages';
import { ApiClient } from '@/lib/api/client';
import ConversationHeader from './ConversationHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';

interface ConversationWindowProps {
  conversation: Conversation;
  apiClient: ApiClient;
}

export default function ConversationWindow({
  conversation,
  apiClient,
}: ConversationWindowProps) {
  const [sendingMessage, setSendingMessage] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [updatingLabel, setUpdatingLabel] = useState(false);

  // Load messages for this conversation
  const { messages, loading: messagesLoading } = useConversationMessages({
    conversationId: conversation.id,
    enabled: !!conversation.id,
  });

  const handleSendMessage = async (messageText: string) => {
    setSendingMessage(true);
    try {
      // Format phone number for WhatsApp API
      // If phone already has @c.us, use as-is, otherwise format it
      let formattedNumber = conversation.customerPhone;
      if (!formattedNumber.includes('@c.us')) {
        // Remove any non-digit characters and ensure it starts with country code
        const cleanNumber = formattedNumber.replace(/\D/g, '');
        // Add @c.us suffix for WhatsApp format
        formattedNumber = `${cleanNumber}@c.us`;
      }

      await apiClient.sendMessage({
        number: formattedNumber,
        message: messageText,
        channel: conversation.channel,
        platformId: conversation.platformId,
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
    try {
      // Format phone number for WhatsApp API
      let formattedNumber = conversation.customerPhone;
      if (!formattedNumber.includes('@c.us')) {
        const cleanNumber = formattedNumber.replace(/\D/g, '');
        formattedNumber = `${cleanNumber}@c.us`;
      }

      await apiClient.updateAiState(formattedNumber, {
        enabled,
        reason,
      });
    } catch (error) {
      console.error('Failed to update AI state:', error);
      throw error;
    } finally {
      setTogglingAi(false);
    }
  };

  const handleLabelChange = async (label: string, reason?: string) => {
    setUpdatingLabel(true);
    try {
      await apiClient.updateLabel(conversation.id, {
        label,
        reason,
      });
    } catch (error) {
      console.error('Failed to update conversation label:', error);
      throw error;
    } finally {
      setUpdatingLabel(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <ConversationHeader
        conversation={conversation}
        onAiStateChange={handleAiStateChange}
        onLabelChange={handleLabelChange}
        loading={togglingAi || updatingLabel}
      />

      {/* Messages */}
      <MessageList messages={messages} loading={messagesLoading} />

      {/* Composer */}
      <MessageComposer
        conversation={conversation}
        onSend={handleSendMessage}
        disabled={sendingMessage}
      />
    </div>
  );
}
