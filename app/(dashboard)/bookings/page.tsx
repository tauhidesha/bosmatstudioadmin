import prisma from '@/lib/prisma';
import BookingsClient from './BookingsClient';
import { Booking } from '@/lib/hooks/useBookings';

export const dynamic = 'force-dynamic';

const cleanServiceText = (text: string) => {
  if (!text) return '';
  return text.split(' § ').map(item => item.split('||')[0]).join(', ');
};

function calculateDurationDays(services: string[]): number {
  const lowerServices = services.map(s => s.toLowerCase());
  
  if (lowerServices.some(s => s.includes('repaint bodi halus'))) return 4;
  if (lowerServices.some(s => s.includes('repaint bodi kasar') || s.includes('repaint velg'))) return 2;
  if (lowerServices.some(s => s.includes('repaint'))) return 3;
  if (lowerServices.some(s => s.includes('coating'))) return 2;
  if (lowerServices.some(s => s.includes('detailing') || s.includes('poles'))) return 1;
  
  return 1;
}

async function getInitialBookings(): Promise<Booking[]> {
  try {
    const limit = 50;
    const bookings = await prisma.booking.findMany({
      include: {
        customer: {
          select: { id: true, name: true, phone: true, profilePicUrl: true }
        },
        vehicle: {
          select: { id: true, modelName: true, plateNumber: true, color: true }
        },
        transaction: true,
      },
      orderBy: { bookingDate: 'desc' },
      take: limit
    });

    return bookings.map(b => {
      const services = b.serviceType 
        ? b.serviceType.split(' § ').map(item => item.split('||')[0])
        : [];

      return {
        id: b.id,
        customerName: b.customerName || b.customer?.name || '',
        customerPhone: b.customerPhone || b.customer?.phone || '',
        vehicleInfo: b.vehicleModel ? `${b.vehicleModel}${b.plateNumber ? ' (' + b.plateNumber + ')' : ''}` : (b.vehicle?.modelName || 'Motor'),
        services,
        serviceName: cleanServiceText(b.serviceType || ''),
        serviceTypeRaw: b.serviceType || '',
        bookingDate: b.bookingDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        bookingTime: b.bookingDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false }).slice(0, 5),
        status: (b.status.toLowerCase() as any),
        subtotal: b.subtotal || 0,
        totalAmount: b.totalAmount || b.subtotal || 0,
        discount: b.discount || 0,
        downPayment: b.downPayment || 0,
        amountPaid: b.amountPaid || 0,
        paymentStatus: b.paymentStatus || 'UNPAID',
        paymentMethod: b.paymentMethod || undefined,
        homeService: b.homeService,
        notes: b.notes || (b as any).adminNotes || undefined,
        realPhone: (b as any).realPhone || '',
        durationDays: calculateDurationDays(services),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    });
  } catch (error) {
    console.error('Error fetching initial bookings:', error);
    return [];
  }
}

export default async function BookingsPage() {
  const initialBookings = await getInitialBookings();

  return (
    <BookingsClient initialBookings={initialBookings} />
  );
}
