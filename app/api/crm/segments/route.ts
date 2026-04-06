import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CTX_SELECT = {
  customerLabel: true,
  followUpStrategy: true,
  labelConfidence: true,
  labelReason: true,
  daysSinceLastChat: true,
  ghostedTimes: true,
  txCount: true,
};

function transform(customers: any[]) {
  return customers.map((c) => ({
    id: c.id,
    name: c.name || c.phone,
    phone: c.phone,
    totalSpending: c.totalSpending,
    lastService: c.lastService?.toISOString() ?? null,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    aiLabel: c.customerContext?.customerLabel ?? null,
    aiStrategy: c.customerContext?.followUpStrategy ?? null,
    aiConfidence: c.customerContext?.labelConfidence ?? 0,
    aiReason: c.customerContext?.labelReason ?? null,
    daysSinceLastChat: c.customerContext?.daysSinceLastChat ?? null,
    ghostedTimes: c.customerContext?.ghostedTimes ?? 0,
  }));
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [vipRaw, atRiskRaw, newRaw] = await Promise.all([
      // VIP: loyal label OR vip strategy OR spending >= 5M
      prisma.customer.findMany({
        where: {
          OR: [
            { customerContext: { customerLabel: 'loyal' } },
            { customerContext: { followUpStrategy: 'vip' } },
            { totalSpending: { gte: 5_000_000 } },
          ],
        },
        include: { customerContext: { select: CTX_SELECT } },
        orderBy: { totalSpending: 'desc' },
        take: 10,
      }),

      // At Risk: churned/dormant label OR daysSinceLastChat > 90
      prisma.customer.findMany({
        where: {
          OR: [
            { customerContext: { customerLabel: { in: ['churned', 'dormant_lead'] } } },
            { customerContext: { daysSinceLastChat: { gt: 90 } } },
          ],
        },
        include: { customerContext: { select: CTX_SELECT } },
        take: 50, // over-fetch to sort by ghostedTimes in JS
      }),

      // New: created within 30 days
      prisma.customer.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: { customerContext: { select: CTX_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Sort At Risk by ghostedTimes DESC, cap to 10
    const atRiskSorted = atRiskRaw
      .sort((a, b) => (b.customerContext?.ghostedTimes ?? 0) - (a.customerContext?.ghostedTimes ?? 0))
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      segments: {
        vip: transform(vipRaw),
        atRisk: transform(atRiskSorted),
        new: transform(newRaw),
      },
    });
  } catch (error: any) {
    console.error('[API CRM Segments]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
