'use client';

import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Booking } from '@/lib/hooks/useBookings';

const locales = {
  'id-ID': id,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  bookings: Booking[];
}

export function CalendarView({ bookings }: CalendarViewProps) {
  const events: Event[] = useMemo(() => {
    return bookings.map(booking => {
      // Parse bookingDate (YYYY-MM-DD) and bookingTime (HH:mm)
      let startDateStr = `${booking.bookingDate}T${booking.bookingTime || '09:00'}:00`;
      let startDate = new Date(startDateStr);
      
      // If parsing fails fallback
      if (isNaN(startDate.getTime())) {
          startDate = new Date();
      }
      
      // Estimate 2 hours for a typical service
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      // Determine color based on status
      let bgColor = '#3b82f6'; // blue (pending)
      if (booking.status === 'in_progress') bgColor = '#f59e0b'; // amber
      else if (booking.status === 'done') bgColor = '#14b8a6'; // teal
      else if (booking.status === 'cancelled') bgColor = '#ef4444'; // red

      return {
        id: booking.id,
        title: `${booking.vehicleInfo} - ${booking.customerName}`,
        start: startDate,
        end: endDate,
        allDay: false,
        resource: {
           status: booking.status,
           services: booking.services,
           phone: booking.customerPhone,
           color: bgColor
        }
      };
    });
  }, [bookings]);

  const eventStyleGetter = (event: Event) => {
    const r = event.resource as any;
    return {
      style: {
        backgroundColor: r?.color || '#3b82f6',
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <div className="h-[600px] w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        eventPropGetter={eventStyleGetter}
        culture="id-ID"
        messages={{
            next: "Maju",
            previous: "Mundur",
            today: "Hari Ini",
            month: "Bulan",
            week: "Minggu",
            day: "Hari"
        }}
        views={['month', 'week', 'day']}
        defaultView="week"
        min={new Date(0, 0, 0, 8, 0, 0)} // Start at 8 AM
        max={new Date(0, 0, 0, 20, 0, 0)} // End at 8 PM
      />
    </div>
  );
}
