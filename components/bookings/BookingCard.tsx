'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Booking } from '@/lib/hooks/useBookings';
import { cn, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';

interface BookingCardProps {
  booking: Booking;
  isOverlay?: boolean;
}

export function BookingCard({ booking, isOverlay }: BookingCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: booking.id,
    data: {
      type: 'Booking',
      booking,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="opacity-40 border-2 border-primary border-dashed rounded-xl bg-primary/5 h-32 w-full" 
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-white p-4 rounded-xl shadow-sm border border-slate-200/60 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group relative",
        isOverlay ? "rotate-2 scale-105 shadow-xl cursor-grabbing" : ""
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-bold text-slate-800 leading-tight">{booking.customerName}</h4>
          <span className="text-[11px] font-semibold text-slate-500">{booking.customerPhone}</span>
        </div>
        <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">
          {booking.bookingDate}
        </div>
      </div>
      
      <div className="mt-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 py-1.5 px-2 rounded-md border border-slate-100">
          <span className="material-symbols-outlined text-[14px] text-teal-600">two_wheeler</span>
          <span className="truncate">{booking.vehicleInfo || 'Motor tidak disebut'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {booking.services.slice(0, 2).map((svc, i) => (
          <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
            {svc}
          </span>
        ))}
        {booking.services.length > 2 && (
          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-1 rounded-full">
            +{booking.services.length - 2}
          </span>
        )}
      </div>

      {(booking.additionalService || booking.notes) && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 line-clamp-2">
          {booking.additionalService && <span className="font-bold text-amber-600 mr-2">[{booking.additionalService}]</span>}
          {booking.notes}
        </div>
      )}

      {/* Action button visible on hover */}
      <Link href={`/conversations?phone=${booking.customerPhone}`} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div className="bg-white hover:bg-slate-50 shadow-sm border border-slate-200 p-1.5 rounded-lg text-blue-600 hover:text-blue-700">
          <span className="material-symbols-outlined text-[16px] block">chat</span>
        </div>
      </Link>
    </div>
  );
}
