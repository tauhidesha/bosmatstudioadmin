'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FollowUpTable, FollowUp } from '@/components/follow-ups/FollowUpTable';
import { FollowUpTemplateModal } from '@/components/follow-ups/FollowUpTemplateModal';

// Dummy data
const mockData: FollowUp[] = [
  { id: '1', customerName: 'Budi Santoso', phone: '+6281234567890', lastServiceDate: '2023-08-15', serviceType: 'Servis Berkala', dueDate: '2023-11-15', status: 'overdue' },
  { id: '2', customerName: 'Andi Wijaya', phone: '+6289876543210', lastServiceDate: '2023-10-20', serviceType: 'Ganti Oli', dueDate: '2023-12-20', status: 'upcoming' },
  { id: '4', customerName: 'Joko Anwar', phone: '+6281234567811', lastServiceDate: '2023-09-01', serviceType: 'Repaint Bodi', dueDate: '2023-11-20', status: 'overdue' },
  { id: '5', customerName: 'Rina Nose', phone: '+6289876543233', lastServiceDate: '2023-10-25', serviceType: 'Servis Ringan', dueDate: '2023-12-25', status: 'upcoming' },
  { id: '3', customerName: 'Siti Aminah', phone: '+6281112223334', lastServiceDate: '2023-07-10', serviceType: 'Servis CVT', dueDate: '2023-09-10', status: 'sent' },
];

export default function FollowUpsPage() {
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);
  const [data, setData] = useState<FollowUp[]>(mockData);

  const handleSend = (followUp: FollowUp, message: string) => {
    // In real app, call API to send WhatsApp message
    console.log(`Sending to ${followUp.phone}: ${message}`);
    
    // Update local state to mark as sent
    setData(prev => prev.map(item => 
      item.id === followUp.id ? { ...item, status: 'sent' } : item
    ));
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-6">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Follow-ups Management</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Kelola dan kirim pengingat jadwal servis untuk retensi pelanggan.</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-8">
        <Tabs defaultValue="overdue" className="w-full">
          <TabsList className="mb-6 bg-white border shadow-sm rounded-lg p-1">
            <TabsTrigger value="overdue" className="rounded-md data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-sm">
              🚨 Overdue ({data.filter(d => d.status === 'overdue').length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-md data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm">
              🗓️ Upcoming ({data.filter(d => d.status === 'upcoming').length})
            </TabsTrigger>
            <TabsTrigger value="sent" className="rounded-md data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">
              ✅ Terkirim ({data.filter(d => d.status === 'sent').length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overdue" className="mt-0">
            <FollowUpTable 
              data={data.filter(d => d.status === 'overdue')} 
              onSendAction={(f) => setSelectedFollowUp(f)} 
            />
          </TabsContent>
          
          <TabsContent value="upcoming" className="mt-0">
            <FollowUpTable 
              data={data.filter(d => d.status === 'upcoming')} 
              onSendAction={(f) => setSelectedFollowUp(f)} 
            />
          </TabsContent>

          <TabsContent value="sent" className="mt-0">
            <FollowUpTable 
              data={data.filter(d => d.status === 'sent')} 
              onSendAction={(f) => setSelectedFollowUp(f)} 
            />
          </TabsContent>
        </Tabs>
      </div>

      <FollowUpTemplateModal 
        followUp={selectedFollowUp}
        open={!!selectedFollowUp}
        onOpenChange={(open) => !open && setSelectedFollowUp(null)}
        onSend={handleSend}
      />
    </div>
  );
}
