/**
 * useRealtimeConversations Hook
 * Manages real-time conversation data from Firestore with onSnapshot
 * 
 * Requirement 1.1: Fetch and display all conversations from Firestore
 * Requirement 1.4: Refresh conversation data every 15 seconds
 * Requirement 5.1: Real-time updates with onSnapshot
 */

'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, Query, Unsubscribe, orderBy } from 'firebase/firestore';
import { db } from '@/lib/auth/firebase';

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  channel: 'whatsapp' | 'instagram' | 'messenger';
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  label?: string;
  aiState?: {
    enabled: boolean;
    pausedUntil?: number;
    reason?: string;
  };
  platformId?: string;
  profilePicUrl?: string;
}

interface UseRealtimeConversationsOptions {
  enabled?: boolean;
}

interface UseRealtimeConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to listen to real-time conversation updates from Firestore
 * Requirement 1.1: Display all conversations from Firestore
 * Requirement 5.1: Use onSnapshot for real-time updates
 */
export function useRealtimeConversations(
  options: UseRealtimeConversationsOptions = {}
): UseRealtimeConversationsReturn {
  const { enabled = true } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log('useRealtimeConversations: enabled =', enabled);
    
    if (!enabled) {
      setLoading(false);
      return;
    }

    let unsubscribe: Unsubscribe | null = null;

    try {
      console.log('useRealtimeConversations: Setting up Firestore listener...');
      
      // Create query for directMessages collection, ordered by last message time
      const conversationsQuery: Query = query(
        collection(db, 'directMessages'),
        orderBy('lastMessageAt', 'desc')
      );

      // Set up real-time listener
      unsubscribe = onSnapshot(
        conversationsQuery,
        (snapshot) => {
          try {
            console.log('useRealtimeConversations: Received snapshot with', snapshot.docs.length, 'documents');
            
            const data = snapshot.docs.map((doc) => {
              console.log('Document:', doc.id, doc.data());
              const docData = doc.data();
              
              // Convert Firestore data to expected Conversation format
              const conversation: Conversation = {
                id: doc.id,
                customerId: docData.fullSenderId || docData.platformId || doc.id,
                customerName: docData.name || 'Unknown User',
                customerPhone: (docData.phone || docData.phoneNumber || docData.fullSenderId || doc.id || 'No phone').split('@')[0],
                channel: (docData.channel || docData.platform || 'whatsapp') as 'whatsapp' | 'instagram' | 'messenger',
                lastMessage: docData.lastMessage || docData.lastMessageText || 'No messages yet',
                lastMessageTime: docData.lastMessageAt?.toMillis() || docData.updatedAt?.toMillis() || docData.createdAt?.toMillis() || Date.now(),
                unreadCount: docData.unreadCount || 0,
                label: docData.customerLabel || docData.label,
                aiState: {
                  enabled: (() => {
                    const aiEnabled = docData.aiEnabled !== false; // Default to true
                    const aiPaused = docData.aiPaused === true;
                    const pausedUntil = docData.aiPausedUntil?.toMillis();
                    
                    if (aiPaused && pausedUntil && Date.now() > pausedUntil) {
                      return true; // Pause expired
                    }
                    
                    return aiEnabled && !aiPaused;
                  })(),
                  pausedUntil: docData.aiPausedUntil?.toMillis(),
                  reason: docData.aiPauseReason || docData.labelReason,
                },
                platformId: docData.platformId || docData.fullSenderId || doc.id,
                profilePicUrl: docData.profilePicUrl?.eurl || docData.profilePicUrl,
              };
              
              return conversation;
            });

            setConversations(data);
            setError(null);
            setLoading(false);
            
            console.log('useRealtimeConversations: Set conversations:', data);
          } catch (err) {
            console.error('useRealtimeConversations: Error processing conversations:', err);
            const error = new Error('Failed to process conversations');
            setError(error);
            setLoading(false);
          }
        },
        (err) => {
          // Requirement 5.1: Error handling in hooks
          console.error('useRealtimeConversations: Firestore listener error:', err);
          const error = new Error('Failed to listen to conversations');
          setError(error);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('useRealtimeConversations: Setup error:', err);
      const error = new Error('Failed to set up conversation listener');
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
          console.warn('Error unsubscribing from conversations:', err);
        }
      }
    };
  }, [enabled]);

  return {
    conversations,
    loading,
    error,
  };
}
