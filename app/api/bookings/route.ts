import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    let limit = 50;

    if (limitParam && !isNaN(parseInt(limitParam, 10))) {
      limit = parseInt(limitParam, 10);
    }

    const firestore = getDb();
    const snapshot = await firestore
      .collection('bookings')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
      
    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      data: bookings
    });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
