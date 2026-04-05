import { Booking } from '@/lib/hooks/useBookings';
import { 
  isSameDay, 
  startOfDay, 
  parseISO, 
  addDays, 
  isAfter, 
  isBefore, 
  addHours 
} from 'date-fns';

/**
 * Helper to check if a booking is active on a specific date based on its duration and status.
 * @param booking - The booking object
 * @param targetDate - The date to check against
 * @returns boolean - True if the booking should be visible/active on that date
 */
export const isBookingActiveOnDate = (booking: Booking, targetDate: Date) => {
  if (booking.status === 'cancelled') return false;
  
  const bookingDay = startOfDay(parseISO(booking.bookingDate));
  const targetDay = startOfDay(targetDate);
  const duration = booking.durationDays || 1;
  const endDay = addDays(bookingDay, duration);

  const isStartDay = isSameDay(bookingDay, targetDay);
  
  // Check if it's within [start, start + duration)
  const isWithinDuration = (isAfter(targetDay, bookingDay) || isSameDay(targetDay, bookingDay)) && 
                           isBefore(targetDay, endDay);

  if (!isWithinDuration) return false;

  // Status-based visibility rules:
  // - If 'paid': only show for 1 hour after payment (grace period) on subsequent days
  //   or always show on the original start day.
  if (booking.status === 'paid') {
    const paidTime = booking.updatedAt ? parseISO(booking.updatedAt) : new Date();
    const expiryTime = addHours(paidTime, 1);
    
    const now = new Date();
    const isToday = isSameDay(now, targetDay);
    
    // Always show on start day
    if (isStartDay) return true;
    
    // Show on subsequent days only if still within 1 hour of payment AND looking at "today"
    if (isToday && isBefore(now, expiryTime)) return true;
    
    return false;
  }

  // - If 'done': stays visible for duration (as per user: "done biarin masih muncul")
  // - Others: stay visible for duration
  return true;
};
