import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/crm/customers
// Query params:
// - limit: number of customers to return (default 50)
// - status: filter by status (active, new, churned)
// - search: text search by name or phone
// - sort: totalSpending|lastService|createdAt|updatedAt (default: updatedAt)
// - order: asc|desc (default: desc)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'updatedAt';
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

    const ALLOWED_SORTS = ['totalSpending', 'lastService', 'createdAt', 'updatedAt'];
    const safeSort = ALLOWED_SORTS.includes(sort) ? sort : 'updatedAt';

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        vehicles: {
          select: {
            id: true,
            modelName: true,
            plateNumber: true,
            color: true,
            _count: { select: { bookings: true } },
          },
        },
        bookings: {
          orderBy: { bookingDate: 'desc' },
          take: 1,
          select: { bookingDate: true, serviceType: true, status: true },
        },
        customerContext: {
          select: {
            customerLabel: true,
            followUpStrategy: true,
            labelConfidence: true,
            labelReason: true,
            daysSinceLastChat: true,
            ghostedTimes: true,
            txCount: true,
          },
        },
        _count: {
          select: { bookings: true, transactions: true, vehicles: true },
        },
      },
      orderBy: { [safeSort]: order },
      take: limit,
    });

    const transformedCustomers = customers.map((c) => ({
      id: c.id,
      name: c.name || c.phone,
      phone: c.phone,
      status: c.status,
      totalSpending: c.totalSpending,
      lastService:
        c.lastService?.toISOString() ||
        c.bookings[0]?.bookingDate?.toISOString() ||
        null,
      bikes: c.vehicles.map((v) => v.modelName),
      vehicles: c.vehicles.map((v) => ({
        id: v.id,
        modelName: v.modelName,
        plateNumber: v.plateNumber,
        color: v.color,
        serviceCount: v._count.bookings,
      })),
      bookingCount: c._count.bookings,
      transactionCount: c._count.transactions,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      phoneReal: c.phoneReal,
      // AI Classifier enrichment
      aiLabel: c.customerContext?.customerLabel ?? null,
      aiStrategy: c.customerContext?.followUpStrategy ?? null,
      aiConfidence: c.customerContext?.labelConfidence ?? 0,
      aiLabelReason: c.customerContext?.labelReason ?? null,
      daysSinceLastChat: c.customerContext?.daysSinceLastChat ?? null,
      ghostedTimes: c.customerContext?.ghostedTimes ?? 0,
    }));

    return NextResponse.json({
      success: true,
      customers: transformedCustomers,
      total: transformedCustomers.length,
    });
  } catch (error: any) {
    console.error('[API CRM] Fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
