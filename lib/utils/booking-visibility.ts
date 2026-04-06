import { Booking } from '@/lib/hooks/useBookings';
import { 
  isSameDay, 
  startOfDay, 
  parseISO, 
  addDays, 
  isAfter, 
  isBefore 
} from 'date-fns';

/**
 * Helper to check if a booking is active on a specific date based on its duration and status.
 * @param booking - The booking object
 * @param targetDate - The date to check against
 * @returns boolean - True if the booking should be visible/active on that date
 */
export const isBookingActiveOnDate = (booking: Booking, targetDate: Date) => {
  if (booking.status === 'cancelled') return false;
  if (booking.status === 'success' || booking.status === 'paid') return false;
  
  const bookingDay = startOfDay(parseISO(booking.bookingDate));
  const targetDay = startOfDay(targetDate);
  const duration = booking.durationDays || 1;
  const endDay = addDays(bookingDay, duration);

  const isStartDay = isSameDay(bookingDay, targetDay);
  
  // Check if it's within [start, start + duration)
  const isWithinDuration = (isAfter(targetDay, bookingDay) || isSameDay(targetDay, bookingDay)) && 
                           isBefore(targetDay, endDay);

  if (!isWithinDuration) return false;

  return true;
};
