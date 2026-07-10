import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: bookingId } = params;
    const body = await req.json();
    const headersList = headers();
    let authHeader = headersList.get('authorization');
    
    // Fallback to __session cookie if Authorization header is missing
    if (!authHeader) {
      const sessionCookie = headersList.get('cookie')?.split(';').find(c => c.trim().startsWith('__session='))?.split('=')[1];
      if (sessionCookie) {
        authHeader = `Bearer ${sessionCookie}`;
      }
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Sesi anda telah berakhir. Silakan login ulang.' }, { status: 401 });
    }

    const { documentType = 'invoice' } = body;

    // Check if booking exists to gather missing data for Express
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        customer: true,
      }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const backendUrl = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://35.232.177.23:4000').trim().replace(/\/$/, "");

    const payload = {
      documentType,
      customerName: booking.customerName || booking.customer?.name || '-',
      customerPhone: booking.customerPhone || booking.customer?.phone || '-',
      realPhone: (booking as any).realPhone || booking.customer?.phoneReal || '',
      motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
      items: booking.serviceType || '-',
      totalAmount: booking.totalAmount || booking.subtotal || 0,
      amountPaid: booking.amountPaid || 0,
      paymentMethod: booking.paymentMethod || 'Transfer BCA',
      notes: booking.notes || '',
      serviceType: booking.category || booking.serviceType || '-',
      subtotal: booking.subtotal || booking.totalAmount || 0,
      discount: booking.discount || 0,
      downPayment: booking.downPayment || 0,
    };

    const response = await fetch(`${backendUrl}/generate-invoice`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorResp = await response.json().catch(() => ({}));
      console.error(`[Invoice Proxy] Backend error ${response.status}:`, errorResp);
      return NextResponse.json(
        { success: false, error: 'Gagal membuat dokumen di backend', details: errorResp },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      message: result.message || 'Dokumen berhasil dibuat dan dikirim'
    });

  } catch (error: any) {
    console.error('[Invoice Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
