import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../auth/firebase';

export type BookingStatus = 'pending' | 'in_progress' | 'done' | 'paid' | 'cancelled';

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleInfo: string;
  bookingDateTime?: any;
  bookingDate: string;
  bookingTime: string;
  status: BookingStatus;
  services: string[];
  category?: string;
  createdAt?: any;
  notes?: string;
  additionalService?: string;
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'bookings'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const fetchedBookings: Booking[] = [];
          snapshot.forEach((doc) => {
            fetchedBookings.push({ id: doc.id, ...doc.data() } as Booking);
          });
          setBookings(fetchedBookings);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching bookings:', err);
          setError(err as Error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up bookings listener:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, []);

  const updateBookingStatus = async (id: string, newStatus: BookingStatus) => {
    try {
      const bookingRef = doc(db, 'bookings', id);
      await updateDoc(bookingRef, { status: newStatus });
      return true;
    } catch (err) {
      console.error('Error updating booking status:', err);
      throw err;
    }
  };

  return { bookings, loading, error, updateBookingStatus };
}
