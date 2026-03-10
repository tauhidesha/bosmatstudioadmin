'use client';

import { useState } from 'react';
import { useRealtimeConversations } from '@/lib/hooks/useRealtimeConversations';
import { useConversationNotifications } from '@/lib/hooks/useConversationNotifications';
import { useAuth } from '@/lib/hooks/useAuth';
import { createApiClient } from '@/lib/api/client';
import ConversationList from '@/components/conversations/ConversationList';
import ConversationWindow from '@/components/conversations/ConversationWindow';
import NotificationPanel from '@/components/shared/NotificationPanel';

// Error Boundary Component for graceful error handling
function ConversationErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-red-900 font-semibold mb-2">Something went wrong</h2>
        <p className="text-red-700 text-sm">
          There was an error loading the conversations. Please refresh the page to try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const { user, getIdToken } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string>();

  // Load conversations with error handling
  const { conversations, loading, error } = useRealtimeConversations({
    enabled: !!user,
  });

  // Set up real-time notifications
  const {
    notifications,
    dismissNotification,
    dismissAllNotifications,
    notificationCount,
    browserNotificationPermission,
  } = useConversationNotifications({
    conversations,
    selectedConversationId,
    enabled: !!user,
  });

  // Create API client
  const apiClient = createApiClient(
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    getIdToken
  );

  // Find selected conversation
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  // Handle conversation selection
  const handleConversationSelect = (conversation: any) => {
    setSelectedConversationId(conversation.id);
  };

  // Handle notification click - navigate to conversation
  const handleNotificationNavigate = (customerId?: string) => {
    if (customerId) {
      setSelectedConversationId(customerId);
    }
  };

  if (error) {
    return (
      <ConversationErrorBoundary>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-900 font-semibold mb-2">Connection Error</h2>
          <p className="text-red-700 text-sm">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </ConversationErrorBoundary>
    );
  }

  return (
    <>
      <div className="flex-1 flex bg-white rounded-lg shadow-sm border overflow-hidden h-[calc(100vh-120px)]">
        {/* Conversation List */}
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleConversationSelect}
          loading={loading}
        />

        {/* Conversation Window */}
        {selectedConversation ? (
          <ConversationWindow
            conversation={selectedConversation}
            apiClient={apiClient}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">
                chat_bubble_outline
              </span>
              <p className="text-slate-500 font-medium">
                Pilih percakapan untuk memulai
              </p>
              <p className="text-slate-400 text-sm mt-2">
                {conversations.length} percakapan tersedia
              </p>
              {notificationCount > 0 && (
                <p className="text-primary text-sm mt-1 font-semibold">
                  {notificationCount} notifikasi baru
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification Panel */}
      <NotificationPanel
        notifications={notifications}
        onDismiss={dismissNotification}
        onNavigate={handleNotificationNavigate}
        position="top-right"
        maxNotifications={5}
      />

      {/* Browser notification permission prompt */}
      {browserNotificationPermission === 'default' && (
        <div className="fixed bottom-4 left-4 bg-white border border-slate-200 rounded-lg shadow-lg p-4 max-w-sm z-50">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary">
              notifications
            </span>
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-slate-900 mb-1">
                Enable Notifications
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                Get notified when new messages arrive, even when the tab is not active.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    Notification.requestPermission();
                  }}
                  className="px-3 py-1 bg-primary text-zinc-950 text-xs font-semibold rounded-lg hover:brightness-105 transition-colors"
                >
                  Enable
                </button>
                <button
                  onClick={() => {
                    // This will be handled by the notification hook
                  }}
                  className="px-3 py-1 text-slate-600 text-xs font-semibold hover:text-slate-900 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
