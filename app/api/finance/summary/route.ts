import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get('month'); // YYYY-MM
    
    let startDate, endDate;
    if (monthStr) {
      startDate = startOfMonth(parseISO(`${monthStr}-01`));
      endDate = endOfMonth(parseISO(`${monthStr}-01`));
    } else {
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'SUCCESS',
      },
    });

    const income = transactions
      .filter(t => t.type.toLowerCase() === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = transactions
      .filter(t => t.type.toLowerCase() === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        totalIncome: income,
        totalExpense: expense,
        netProfit: income - expense,
        transactionCount: transactions.length,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
