import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, active, newCount, churnedCtx, revenueAgg] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: 'active' } }),
      prisma.customer.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.customerContext.count({
        where: { customerLabel: { in: ['churned', 'dormant_lead'] } },
      }),
      prisma.customer.aggregate({ _sum: { totalSpending: true } }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        total,
        active,
        new: newCount,
        churned: churnedCtx,
        totalRevenue: revenueAgg._sum.totalSpending ?? 0,
      },
    });
  } catch (error: any) {
    console.error('[API CRM Stats]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
