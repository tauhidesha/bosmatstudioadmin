'use client';

import React, { useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useBookings, BookingStatus } from '@/lib/hooks/useBookings';
import { BoardColumn } from '@/components/bookings/BoardColumn';
import { BookingCard } from '@/components/bookings/BookingCard';

const COLUMNS: { id: BookingStatus; title: string, color: string }[] = [
  { id: 'pending', title: 'New Booking', color: 'border-blue-500' },
  { id: 'in_progress', title: 'Sedang Dikerjakan', color: 'border-amber-500' },
  { id: 'done', title: 'Selesai', color: 'border-teal-500' },
  { id: 'cancelled', title: 'Dibatalkan', color: 'border-red-500' },
];

export default function BookingsPage() {
  const { bookings, loading, updateBookingStatus } = useBookings();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-50">
        <div className="animate-spin size-8 border-4 border-slate-200 border-t-teal-500 rounded-full"></div>
      </div>
    );
  }

  const columns = COLUMNS.map(col => ({
    ...col,
    items: bookings.filter(b => b.status === col.id)
  }));

  const activeBooking = activeId ? bookings.find(b => b.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id;
    const overData = over.data.current;
    let newStatus: BookingStatus | undefined;

    if (overData?.type === 'Column') {
      newStatus = overData.columnId as BookingStatus;
    } else if (overData?.type === 'Booking') {
      newStatus = overData.booking.status as BookingStatus;
    }

    const currentBooking = bookings.find(b => b.id === draggedId);
    if (newStatus && currentBooking && currentBooking.status !== newStatus) {
      await updateBookingStatus(draggedId as string, newStatus);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50">
      <div className="p-6 pb-2 border-b border-slate-200 bg-white shadow-sm z-10 flex-shrink-0">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Manajemen Kanban Booking</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Geser kartu antrean sesuai progres motor di studio.</p>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-6 items-start pb-4">
            {columns.map(col => (
              <BoardColumn key={col.id} id={col.id} title={col.title} items={col.items} headerColor={col.color} />
            ))}
          </div>

          <DragOverlay>
            {activeBooking ? <BookingCard booking={activeBooking} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
