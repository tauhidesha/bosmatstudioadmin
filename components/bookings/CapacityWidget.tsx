'use client';

import React, { useMemo } from 'react';
import { Booking } from '@/lib/hooks/useBookings';
import { PaintBucket, Sparkles } from 'lucide-react';

interface CapacityWidgetProps {
  bookings: Booking[];
}

export function CapacityWidget({ bookings }: CapacityWidgetProps) {
  const { repaintCount, detailingCount } = useMemo(() => {
    let repaintActive = 0;
    let detailingToday = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    bookings.forEach(booking => {
      // Exclude cancelled bookings from capacity calculating
      if (booking.status === 'cancelled') return;

      const servicesList = Array.isArray(booking.services) ? booking.services : [booking.services].filter(Boolean);
      const servicesStr = servicesList.join(' ').toLowerCase();
      
      const isRepaint = servicesStr.includes('repaint') || servicesStr.includes('repair');
      const isDetailing = servicesStr.includes('detailing') || servicesStr.includes('coating') || servicesStr.includes('cuci') || servicesStr.includes('wash');

      if (isRepaint) {
        // Repaint uses capacity if it's currently waiting/pending or in_progress
        if (booking.status === 'waiting' || booking.status === 'pending' || (booking.status as string) === 'in_progress') {
          repaintActive += 1;
        }
      } else if (isDetailing) {
        // Detailing uses capacity per day. So if it's scheduled for today and not cancelled.
        if (booking.bookingDate === todayStr) {
          detailingToday += 1;
        }
      }
    });

    return { repaintCount: repaintActive, detailingCount: detailingToday };
  }, [bookings]);

  const maxRepaint = 2;
  const maxDetailing = 2;

  const repaintPercentage = Math.min(100, Math.round((repaintCount / maxRepaint) * 100));
  const detailingPercentage = Math.min(100, Math.round((detailingCount / maxDetailing) * 100));

  return (
    <div className="flex gap-4 mb-6">
      <div className="bg-[#1c1b1b] border border-white/5 p-4 flex-1 flex flex-col justify-between rounded-sm">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#FFFF00]/10 text-[#FFFF00] rounded-lg">
              <PaintBucket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white font-headline uppercase text-xs tracking-widest">Kapasitas Repaint</h3>
              <p className="text-[10px] text-white/40 font-medium font-headline uppercase">Dalam Pengerjaan</p>
            </div>
          </div>
          <span className={`font-black text-xl font-headline ${repaintCount >= maxRepaint ? 'text-red-500' : 'text-white'}`}>
            {repaintCount} <span className="text-white/30 text-sm font-semibold">/ {maxRepaint}</span>
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
          <div 
            className={`h-full rounded-full ${repaintCount >= maxRepaint ? 'bg-red-500' : 'bg-[#FFFF00]'}`}
            style={{ width: `${repaintPercentage}%` }}
          />
        </div>
        {repaintCount >= maxRepaint && (
          <p className="text-[9px] text-red-500 mt-2 font-black font-headline uppercase tracking-widest">Kapasitas penuh! Stop terima booking repaint.</p>
        )}
      </div>

      <div className="bg-[#1c1b1b] border border-white/5 p-4 flex-1 flex flex-col justify-between rounded-sm">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#FFFF00]/10 text-[#FFFF00] rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white font-headline uppercase text-xs tracking-widest">Kapasitas Detailing</h3>
              <p className="text-[10px] text-white/40 font-medium font-headline uppercase">Jadwal Hari Ini</p>
            </div>
          </div>
          <span className={`font-black text-xl font-headline ${detailingCount >= maxDetailing ? 'text-red-500' : 'text-white'}`}>
            {detailingCount} <span className="text-white/30 text-sm font-semibold">/ {maxDetailing}</span>
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
          <div 
            className={`h-full rounded-full ${detailingCount >= maxDetailing ? 'bg-red-500' : 'bg-[#FFFF00]'}`}
            style={{ width: `${detailingPercentage}%` }}
          />
        </div>
        {detailingCount >= maxDetailing && (
           <p className="text-[9px] text-red-500 mt-2 font-black font-headline uppercase tracking-widest">Slot detailing hari ini sudah penuh.</p>
        )}
      </div>
    </div>
  );
}
