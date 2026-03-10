/**
 * useConversationMessages Hook
 * Manages real-time message history for a specific conversation
 * 
 * Requirement 1.5: Display complete message history with sender labels
 * Requirement 5.1: Real-time updates with onSnapshot
 */

'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Query,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/auth/firebase';

export interface Message {
  id: string;
  conversationId: string;
  sender: 'customer' | 'ai' | 'admin';
  senderName?: string;
  content: string;
  timestamp: number;
  channel?: string;
  platformId?: string;
}

interface UseConversationMessagesOptions {
  conversationId?: string;
  enabled?: boolean;
}

interface UseConversationMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to listen to real-time message updates for a specific conversation
 * Requirement 1.5: Display complete message history
 * Requirement 5.1: Use onSnapshot for real-time updates
 */
export function useConversationMessages(
  options: UseConversationMessagesOptions = {}
): UseConversationMessagesReturn {
  const { conversationId, enabled = true } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !conversationId) {
      setLoading(false);
      setMessages([]);
      return;
    }

    let unsubscribe: Unsubscribe | null = null;

    try {
      console.log('useConversationMessages: Setting up listener for conversation:', conversationId);
      
      // Messages are stored as a subcollection under each conversation
      const messagesQuery: Query = query(
        collection(db, 'directMessages', conversationId, 'messages'),
        orderBy('timestamp', 'asc')
      );

      // Set up real-time listener
      unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          try {
            console.log('useConversationMessages: Received', snapshot.docs.length, 'messages');
            
            const data = snapshot.docs.map((doc) => {
              const docData = doc.data();
              console.log('Message doc:', doc.id, docData);
              
              return {
                id: doc.id,
                conversationId: conversationId,
                sender: docData.sender || docData.role || 'customer',
                senderName: docData.senderName || docData.name,
                content: docData.content || docData.text || docData.message || '',
                timestamp: docData.timestamp?.toMillis() || docData.createdAt?.toMillis() || Date.now(),
                channel: docData.channel,
                platformId: docData.platformId,
              } as Message;
            });

            setMessages(data);
            setError(null);
            setLoading(false);
            
            console.log('useConversationMessages: Set messages:', data);
          } catch (err) {
            console.error('useConversationMessages: Error processing messages:', err);
            const error = new Error('Failed to process messages');
            setError(error);
            setLoading(false);
          }
        },
        (err) => {
          // Requirement 5.1: Error handling in hooks
          console.error('useConversationMessages: Firestore listener error:', err);
          const error = new Error('Failed to listen to messages');
          setError(error);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('useConversationMessages: Setup error:', err);
      const error = new Error('Failed to set up message listener');
      setError(error);
      setLoading(false);
    }

    // Cleanup on unmount to prevent memory leaks
    // Requirement 5.1: Implement cleanup on unmount
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          // Silently handle unsubscribe errors
          console.warn('Error unsubscribing from messages:', err);
        }
      }
    };
  }, [conversationId, enabled]);

  return {
    messages,
    loading,
    error,
  };
}
