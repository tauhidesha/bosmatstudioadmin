'use client';

import { useState } from 'react';
import Modal from '@/components/shared/Modal';
import ManualBookingForm from '@/components/bookings/ManualBookingForm';
import { ApiClient } from '@/lib/api/client';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';

interface FloatingBookingButtonProps {
  conversation: Conversation;
  allConversations: Conversation[];
  apiClient: ApiClient;
}

export default function FloatingBookingButton({
  conversation,
  allConversations,
  apiClient,
}: FloatingBookingButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <div className="absolute bottom-[110px] left-4 z-40 md:hidden">
        <button
          onClick={() => setShowModal(true)}
          className="
            flex items-center gap-2
            bg-[#FFFF00] text-black
            px-6 py-2.5 rounded-lg
            text-[10px] font-headline font-bold tracking-[0.15em] uppercase
            shadow-[0_4px_20px_rgba(255,255,0,0.3)]
            hover:bg-[#eaea00] active:scale-95
            transition-all duration-150
          "
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            calendar_add_on
          </span>
          Buat Booking
        </button>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Booking Manual"
        size="6xl"
      >
        <ManualBookingForm
          initialData={{
            customerName: conversation.customerName,
            customerPhone: conversation.customerPhone,
            vehicleModel: conversation.customerContext?.motorModel,
            plateNumber: conversation.customerContext?.motorPlate,
            services: conversation.customerContext?.targetServices?.map((svc: string) => {
              if (conversation.customerContext?.quotedServices && Array.isArray(conversation.customerContext.quotedServices)) {
                const quoted = conversation.customerContext.quotedServices.find((q: any) => 
                  q.service?.toLowerCase().includes(svc.toLowerCase()) || 
                  svc.toLowerCase().includes(q.service?.toLowerCase())
                );
                if (quoted && quoted.price) {
                  return `${svc} [Rp${quoted.price}]`;
                }
              }
              return svc;
            }),
            notes: conversation.customerContext?.serviceDetail ? `Catatan Tambahan: ${conversation.customerContext.serviceDetail}` : undefined,
          }}
          allConversations={allConversations}
          apiClient={apiClient}
          onSuccess={() => {
            setShowModal(false);
          }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </>
  );
}
