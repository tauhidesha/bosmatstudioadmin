import { NextRequest, NextResponse } from 'next/server';

import generateInvoiceHTML from '../../../../../lib/templates/invoiceTemplate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.items) {
      return NextResponse.json(
        { success: false, error: 'Missing items field' },
        { status: 400 }
      );
    }

    const html = generateInvoiceHTML({
      ...body,
      docNumber: body.docNumber || 'PREVIEW',
      now: new Date(),
    });

    return NextResponse.json({ success: true, html });
  } catch (error: any) {
    console.error('[Invoice Preview] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate preview', details: error.message },
      { status: 500 }
    );
  }
}