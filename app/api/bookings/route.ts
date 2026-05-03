import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cleanServiceText = (text: string) => {
  if (!text) return '';
  return text.split(' § ').map(item => item.split('||')[0]).join(', ');
};

// GET /api/bookings
// Query params:
// - limit: number of bookings to return (default 50)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const customerPhone = searchParams.get('customerPhone');

    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (customerPhone) {
      where.customerPhone = { contains: customerPhone };
    }

    const bookings = await prisma.booking.findMany({
      where,
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

    const transformedBookings = bookings.map(b => {
      const services = b.serviceType 
        ? b.serviceType.split(' § ').map(item => item.split('||')[0])
        : [];

      return {
        id: b.id,
        customerName: b.customerName || b.customer?.name,
        customerPhone: b.customerPhone || b.customer?.phone,
        vehicleInfo: b.vehicleModel ? `${b.vehicleModel}${b.plateNumber ? ' (' + b.plateNumber + ')' : ''}` : b.vehicle?.modelName,
        services,
        serviceName: cleanServiceText(b.serviceType || ''),
        serviceTypeRaw: b.serviceType || '',
        bookingDate: b.bookingDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        bookingTime: b.bookingDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false }).slice(0, 5),
        status: b.status.toLowerCase(),
        subtotal: b.subtotal || 0,
        totalAmount: b.totalAmount || b.subtotal || 0,
        discount: b.discount || 0,
        downPayment: b.downPayment || 0,
        amountPaid: b.amountPaid || 0,
        paymentStatus: b.paymentStatus || 'UNPAID',
        paymentMethod: b.paymentMethod,
        homeService: b.homeService,
        notes: b.notes || (b as any).adminNotes,
        realPhone: (b as any).realPhone || '',
        durationDays: calculateDurationDays(services),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedBookings
    });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/bookings
// Create a new booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      customerId,
      customerName, 
      customerPhone, 
      serviceName, 
      bookingDate, 
      bookingTime, 
      vehicleInfo, 
      plateNumber,
      motorModel,
      color,
      notes, 
      subtotal, 
      totalAmount,
      status,
      homeService, 
      invoiceName, 
      dpAmount,
      paymentMethod,
      realPhone,
      amountPaid,
      discount,
      downPayment: formDownPayment
    } = body;


    if (!customerName || !customerPhone || !serviceName || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customerName, customerPhone, serviceName, bookingDate, bookingTime' },
        { status: 400 }
      );
    }

    const normalizedPhone = customerPhone.replace(/\D/g, '');
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00+07:00`);
    const downPayment = formDownPayment !== undefined ? formDownPayment : (dpAmount || 0);

    const modelToUse = motorModel || (vehicleInfo ? extractModelFromText(vehicleInfo) : null);
    const plateToUse = plateNumber || extractPlateFromText(vehicleInfo);

    // 1. Find or create customer (using phoneReal if possible)
    let existingCustomer = null;
    
    if (customerId) {
      existingCustomer = await prisma.customer.findUnique({
        where: { id: customerId }
      });
    }

    if (!existingCustomer) {
      // Match against phone with or without @lid/@c.us suffix
      const phoneVariants = [
        normalizedPhone,
        `${normalizedPhone}@lid`,
        `${normalizedPhone}@c.us`,
      ];
      existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { phoneReal: normalizedPhone },
            { phone: { in: phoneVariants } },
          ]
        }
      });
    }

    const customer = existingCustomer
      ? await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: { 
            phoneReal: realPhone ? realPhone.replace(/\D/g, '') : (existingCustomer.phoneReal || normalizedPhone),
            // Sync name if different (prevents split identities like "Arul" vs "Rully")
            ...(customerName && existingCustomer.name !== customerName ? { name: customerName } : {})
          }
        })
      : await prisma.customer.create({
          data: { 
            phone: customerPhone, // Keep original with suffix if provided
            phoneReal: realPhone ? realPhone.replace(/\D/g, '') : normalizedPhone,
            name: customerName,
            status: 'new',
            totalSpending: 0,
          }
        });

    // 2. Upsert vehicle
    const vehicle = plateToUse ? await prisma.vehicle.upsert({
      where: { 
        customerId_plateNumber: { 
          customerId: customer.id, 
          plateNumber: plateToUse.toUpperCase().trim()
        }
      },
      update: { modelName: modelToUse || 'Motor' },
      create: { 
        customerId: customer.id, 
        modelName: modelToUse || 'Motor', 
        plateNumber: plateToUse.toUpperCase().trim()
      }
    }) : null;

    const vehicleId = vehicle?.id;
    const finalPlateNumber = vehicle?.plateNumber;
    const finalVehicleModel = vehicle?.modelName;

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        vehicleId,
        customerName,
        customerPhone: normalizedPhone,
        plateNumber: finalPlateNumber,
        vehicleModel: finalVehicleModel,
        bookingDate: bookingDateTime,
        serviceType: serviceName,
        status: status?.toUpperCase() || 'PENDING',
        notes,
        subtotal: subtotal || 0,
        totalAmount: (totalAmount !== undefined && totalAmount !== null) ? totalAmount : (subtotal || 0),
        discount: discount || 0,
        downPayment: downPayment || null,
        homeService: homeService || false,
        paymentMethod,
        realPhone: realPhone || '',
        category: getServiceCategory(serviceName),
        amountPaid: Math.max(downPayment || 0, amountPaid || 0)
      } as any
    });

    // Create down payment transaction if provided
    if (downPayment > 0) {
      await prisma.transaction.create({
        data: {
          customerId: customer.id,
          bookingId: booking.id,
          amount: downPayment,
          type: 'income',
          status: 'SUCCESS',
          description: `Down Payment - ${serviceName}`,
          paymentMethod: paymentMethod || 'transfer',
        }
      });

      // Update customer totalSpending
      await prisma.customer.update({
        where: { id: customer.id },
        data: { 
          totalSpending: { increment: downPayment }
        }
      });
    }

    // If amountPaid > dpAmount, create additional transaction for the difference
    const paidAmount = amountPaid || 0;
    if (paidAmount > downPayment && paidAmount > 0) {
      const additionalPayment = paidAmount - downPayment;
      await prisma.transaction.create({
        data: {
          customerId: customer.id,
          bookingId: booking.id,
          amount: additionalPayment,
          type: 'income',
          status: 'SUCCESS',
          description: `Pembayaran Service: ${serviceName}`,
          paymentMethod: paymentMethod || 'transfer',
        }
      });

      // Update customer totalSpending for additional payment
      await prisma.customer.update({
        where: { id: customer.id },
        data: { 
          totalSpending: { increment: additionalPayment }
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: { 
        id: booking.id,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        vehicleInfo: finalVehicleModel,
        plateNumber: finalPlateNumber,
        services: booking.serviceType ? booking.serviceType.split(' § ').map(s => s.split('||')[0]) : [],
        serviceName: cleanServiceText(booking.serviceType || ''),
        serviceTypeRaw: booking.serviceType || '',
        bookingDate: booking.bookingDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        bookingTime: booking.bookingDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false }).slice(0, 5),
        status: 'pending',
        subtotal: booking.subtotal,
        totalAmount: booking.totalAmount || booking.subtotal,
        downPayment: booking.downPayment,
        amountPaid: booking.amountPaid || 0,
        paymentStatus: booking.paymentStatus || 'UNPAID',
        durationDays: calculateDurationDays([booking.serviceType]),
      },
      message: `Booking untuk ${customerName} berhasil dibuat`,
    });
  } catch (error: any) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal membuat booking', details: error.message },
      { status: 500 }
    );
  }
}


function getServiceCategory(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  if (lower.includes('repaint') || lower.includes('cat')) return 'repaint';
  if (lower.includes('coating') || lower.includes('glossy') || lower.includes('doff') || lower.includes('complete service') || lower.includes('nano ceramic')) return 'coating';
  if (lower.includes('detailing')) return 'detailing';
  return 'service';
}

function extractModelFromText(text: string | null): string | null {
  if (!text) return null;
  const keywords = ['beat', 'vario', 'supra', 'mio', 'nmax', 'vixion', 'rx', 'scoopy', 'crf', 'cbr', 'ninja', 'mt', 'duke', 'domi', 'sprint', 'adv', 'pcx', 'sh', 'jazz', 'brio', 'city'];
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      return text;
    }
  }
  return null;
}

function extractPlateFromText(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/([A-Z]{1,2})\s*([0-9]{1,5})\s*([A-Z]{0,4})/i);
  return match ? match[0].toUpperCase().replace(/\s+/g, ' ') : null;
}
// PATCH /api/bookings
// Update an existing booking
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, notes, adminNotes, bookingDate, serviceType, realPhone } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    const data: any = {};
    if (status) data.status = status.toUpperCase();
    if (notes !== undefined) data.notes = notes;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;
    if (bookingDate) data.bookingDate = new Date(bookingDate);
    if (serviceType) data.serviceType = serviceType;
    if (realPhone !== undefined) data.realPhone = realPhone;

    const booking = await prisma.booking.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: booking,
      message: 'Booking berhasil diperbarui',
    });
  } catch (error: any) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui booking', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/bookings?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    await prisma.transaction.deleteMany({ where: { bookingId: id } });
    await prisma.booking.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Booking berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus booking', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/bookings
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    const existingBooking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!existingBooking) {
      return NextResponse.json({ success: false, error: "Booking tidak ditemukan" }, { status: 404 });
    }

    // Transfom frontend payload to DB field names if necessary
    const updateData: any = {};
    if (data.customerName) updateData.customerName = data.customerName;
    if (data.customerPhone) updateData.customerPhone = data.customerPhone.replace(/\D/g, '');
    if (data.serviceName) {
      updateData.serviceType = data.serviceName;
      updateData.category = getServiceCategory(data.serviceName);
    }
    if (data.bookingDate && data.bookingTime) {
      updateData.bookingDate = new Date(`${data.bookingDate}T${data.bookingTime}:00+07:00`);
    }
    const modelToUse = data.motorModel || (data.vehicleInfo ? data.vehicleInfo.split(' (')[0] : null);
    const plateToUse = data.plateNumber || (data.vehicleInfo && data.vehicleInfo.includes(' (') ? data.vehicleInfo.split(' (')[1].replace(')', '') : null);

    if (modelToUse) updateData.vehicleModel = modelToUse;
    if (plateToUse) updateData.plateNumber = plateToUse;
    if (data.status) updateData.status = data.status.toUpperCase();
    const finalTotal = data.totalAmount !== undefined ? data.totalAmount : (existingBooking.totalAmount || existingBooking.subtotal || 0);

    const prevDp = existingBooking.downPayment || 0;
    const prevAmountPaid = existingBooking.amountPaid || 0;
    
    let newDp = prevDp;
    if (data.downPayment !== undefined) newDp = data.downPayment;
    else if (data.dpAmount !== undefined) newDp = data.dpAmount;
    
    if (newDp !== prevDp) {
        updateData.downPayment = newDp;
    }
    const dpDiff = newDp - prevDp;

    let targetAmountPaid = prevAmountPaid;
    if (data.amountPaid !== undefined) {
        targetAmountPaid = Math.max(data.amountPaid, prevAmountPaid + dpDiff); 
    } else {
        targetAmountPaid = prevAmountPaid + dpDiff;
    }
    
    updateData.amountPaid = targetAmountPaid;
    
    if (updateData.amountPaid >= finalTotal && finalTotal > 0) {
        updateData.paymentStatus = 'PAID';
    } else if (updateData.amountPaid > 0) {
        updateData.paymentStatus = 'PARTIAL';
    } else {
        updateData.paymentStatus = 'UNPAID';
    }

    if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.homeService !== undefined) updateData.homeService = data.homeService;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
    if (data.realPhone !== undefined) updateData.realPhone = data.realPhone;
    if (data.discount !== undefined) updateData.discount = data.discount;

    const booking = await prisma.booking.update({
      where: { id },
      data: updateData,
    });

    // Also update customer's real phone and name if provided
    const customerRealPhone = (data.realPhone || updateData.realPhone || (booking as any).realPhone);
    if (booking.customerId) {
      const customerUpdateData: any = {};
      if (customerRealPhone) customerUpdateData.phoneReal = customerRealPhone.replace(/\D/g, '');
      // Sync customer name if booking name changed
      if (data.customerName) customerUpdateData.name = data.customerName;
      
      if (Object.keys(customerUpdateData).length > 0) {
        await prisma.customer.update({
          where: { id: booking.customerId },
          data: customerUpdateData
        });
      }
    }

    // Transaction logic
    const totalAdditionalPaymentNeeded = targetAmountPaid - prevAmountPaid;
    
    if (dpDiff > 0) {
        await prisma.transaction.create({
            data: {
                customerId: booking.customerId,
                bookingId: id,
                amount: dpDiff,
                type: 'income',
                status: 'SUCCESS',
                description: `Down Payment - ${existingBooking.serviceType}`,
                paymentMethod: data.paymentMethod || existingBooking.paymentMethod || 'transfer',
            }
        });
        
        await prisma.customer.update({
            where: { id: booking.customerId },
            data: { totalSpending: { increment: dpDiff } }
        });
    }

    const regularPaymentNeeded = totalAdditionalPaymentNeeded - Math.max(0, dpDiff);
    if (regularPaymentNeeded > 0) {
        await prisma.transaction.create({
            data: {
                customerId: booking.customerId,
                bookingId: id,
                amount: regularPaymentNeeded,
                type: 'income',
                status: 'SUCCESS',
                description: `Pembayaran Service: ${existingBooking.serviceType}`,
                paymentMethod: data.paymentMethod || existingBooking.paymentMethod || 'transfer',
            }
        });
        
        // Update customer totalSpending
        await prisma.customer.update({
            where: { id: booking.customerId },
            data: { 
                totalSpending: { increment: regularPaymentNeeded }
            }
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...booking,
        bookingDate: booking.bookingDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        bookingTime: booking.bookingDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false }).slice(0, 5),
        status: booking.status.toLowerCase(),
        serviceName: cleanServiceText(booking.serviceType || ''),
        serviceTypeRaw: booking.serviceType || '',
        services: booking.serviceType ? booking.serviceType.split(' § ').map(s => s.split('||')[0]) : [],
        durationDays: calculateDurationDays([booking.serviceType]),
      },
      message: 'Booking berhasil diperbarui sepenuhnya',
    });
  } catch (error: any) {
    console.error('Error in PUT booking:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui booking', details: error.message },
      { status: 500 }
    );
  }
}

function calculateDurationDays(services: string[]): number {
  const lowerServices = services.map(s => s.toLowerCase());
  
  if (lowerServices.some(s => s.includes('repaint bodi halus'))) return 4;
  if (lowerServices.some(s => s.includes('repaint bodi kasar') || s.includes('repaint velg'))) return 2;
  if (lowerServices.some(s => s.includes('repaint'))) return 3;
  if (lowerServices.some(s => s.includes('coating'))) return 2;
  if (lowerServices.some(s => s.includes('detailing') || s.includes('poles'))) return 1;
  
  return 1;
}
