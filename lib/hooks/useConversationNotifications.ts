/**
 * useConversationNotifications Hook
 * Detects new messages and creates notifications for unselected conversations
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.7
 */

'use client';

import { useEffect, useRef } from 'react';
import { Conversation } from './useRealtimeConversations';
import { useNotifications } from '@/components/shared/useNotifications';

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface UseConversationNotificationsOptions {
  conversations: Conversation[];
  selectedConversationId?: string;
  enabled?: boolean;
}

export function useConversationNotifications({
  conversations,
  selectedConversationId,
  enabled = true,
}: UseConversationNotificationsOptions) {
  const previousTimesRef = useRef<Record<string, number>>({});
  const hasInitializedRef = useRef(false);

  const {
    notifications,
    addNotification,
    dismissNotification,
    dismissAllNotifications,
    dismissCustomerNotifications,
    browserNotificationPermission,
  } = useNotifications({
    enableSound: true,
    enableBrowserNotification: true,
  });

  // Request browser notification permission on first load and setup push
  useEffect(() => {
    async function setupWebPush() {
      if (!enabled || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidPublicKey) {
            console.warn('No VAPID public key available');
            return;
          }

          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }

        // Send subscription to backend
        await fetch('/api/web-push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });
      } catch (error) {
        console.error('Error setting up web push:', error);
      }
    }

    setupWebPush();
  }, [enabled]);

  // Detect new messages and create notifications
  useEffect(() => {
    if (!enabled || !conversations.length) return;

    const previousTimes = previousTimesRef.current;
    const nextTimes: Record<string, number> = {};

    conversations.forEach((conversation) => {
      // Use lastCustomerMessageTime so fast AI replies don't mask new user messages
      const currentTime = conversation.lastCustomerMessageTime || conversation.lastMessageTime || 0;
      nextTimes[conversation.id] = currentTime;

      // Skip if this is the first load (initialization)
      if (!hasInitializedRef.current) return;

      const previousTime = previousTimes[conversation.id] || 0;
      const hasNewMessage = currentTime > previousTime;
      const isSelected = conversation.id === selectedConversationId;

      // Only notify for new customer messages in unselected conversations
      if (hasNewMessage && !isSelected) {
        addNotification({
          customerName: conversation.customerName || 'Unknown User',
          messagePreview: conversation.lastMessage || 'Pesanan/Pesan baru masuk',
          timestamp: new Date(),
          customerId: conversation.id,
        });
      }
    });

    previousTimesRef.current = nextTimes;
    hasInitializedRef.current = true;
  }, [conversations, selectedConversationId, enabled, addNotification]);

  // Clear notifications when a conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      dismissCustomerNotifications(selectedConversationId);
    }
  }, [selectedConversationId, dismissCustomerNotifications]);

  return {
    notifications,
    dismissNotification,
    dismissAllNotifications,
    dismissCustomerNotifications,
    browserNotificationPermission,
    notificationCount: notifications.length,
  };
}