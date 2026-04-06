import { NextRequest, NextResponse } from 'next/server';

// Inline the invoice template to avoid cross-project import issues
function generateInvoiceHTML(data: any): string {
  const {
    documentType, customerName, motorDetails, items,
    finalTotal, totalAmount, amountPaid, paymentMethod, notes,
    recipientNumber, bookingDate, docNumber, now, detectedSize,
    logoBase64, realPhone, subtotal: subtotalParam, discount
  } = data;

  const subtotal = Number(subtotalParam || finalTotal || totalAmount) || 0;
  const discountAmount = Number(discount) || 0;
  const paid = Number(amountPaid) || 0;
  const balance = Math.max(0, subtotal - discountAmount - paid);

  const displayPhone = realPhone
    ? realPhone.replace(/^62/, '0')
    : (recipientNumber || '-')
        .replace('@c.us', '')
        .replace('@lid', '')
        .replace(/^62/, '0');

  const itemsList = (items || '').split('\n').map((i: string) => i.trim()).filter(Boolean);

  let filteredNotes = notes || '-';
  if (filteredNotes && filteredNotes !== '-' && filteredNotes.match(/^Layanan:\s*/i)) {
    const headerRemoved = filteredNotes.replace(/^Layanan:\s*/i, '').trim();
    const itemsSummary = itemsList.map((i: string) => i.split('||')[0].trim()).join(', ');
    if (headerRemoved === itemsSummary) {
      filteredNotes = '';
    } else {
      filteredNotes = headerRemoved;
    }
  }

  const notesList = (filteredNotes && filteredNotes !== '-') 
    ? filteredNotes.split('\n')
        .map((n: string) => n.trim())
        .filter((n: string) => n && !n.match(/^Layanan:?$/i))
    : [];

  // Build items rows safely
  const itemsRows = itemsList.map((item: string) => {
    try {
      const parts = item.split('||');
      const cleanTitle = (parts[0] || '').trim().replace(/^(\d+\.|[-*•])\s*/, '');
      const price = parseInt(parts[1]) || 0;
      const itemDesc = (parts[2] || '').trim();
      const priceStr = price > 0 ? `Rp${price.toLocaleString('id-ID')}` : '-';

      return `
      <tr class="item-row" style="page-break-inside: avoid;">
        <td>
          <p class="font-headline" style="font-size:18px; font-weight:700; text-transform:uppercase">${cleanTitle}</p>
          ${itemDesc ? (
            itemDesc.startsWith('Catatan Warna:') 
            ? `<div style="display:flex; align-items:center; gap:6px; margin-top:6px; padding:4px 10px; background:rgba(255,255,0,0.05); border-left:2px solid #FFFF00; width:fit-content">
                <span style="font-size:10px; color:#FFFF00; font-weight:800; text-transform:uppercase; letter-spacing:0.1em">🎨 ${itemDesc}</span>
               </div>`
            : `<p class="text-muted" style="font-size:12px; line-height:1.4; margin-top:4px">${itemDesc}</p>`
          ) : ''}
        </td>
        <td style="text-align:center"><p class="font-headline" style="font-size:18px; font-weight:700">01</p></td>
        <td style="text-align:right"><p class="text-muted" style="font-size:14px">${priceStr}</p></td>
        <td style="text-align:right"><p class="font-headline text-yellow" style="font-size:18px; font-weight:700">${priceStr}</p></td>
      </tr>`;
    } catch (e) {
      return '';
    }
  }).join('');

  // Build notes safely
  const notesHtml = notesList.length > 0 ? `
  <div class="bg-darker border-yellow" style="padding:32px; margin-bottom:24px">
    <p class="font-headline" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:16px">Catatan Teknis Layanan</p>
    <div style="display:flex; flex-direction:column; gap:8px">
      ${notesList.map((n: string) => {
        let icon = '●';
        const lowerN = n.toLowerCase();
        if (lowerN.includes('garansi')) icon = '✓';
        else if (lowerN.includes('waktu') || lowerN.includes('jam') || lowerN.includes('hari')) icon = '⏱';
        return `<div style="display:flex; gap:10px; align-items:flex-start"><span style="color:#FFFF00; font-size:14px; margin-top:2px">${icon}</span><p class="text-muted" style="font-size:14px; line-height:1.5">${n}</p></div>`;
      }).join('')}
    </div>
  </div>` : '';

  const dpRow = paid > 0 ? `
  <div style="display:flex; justify-content:space-between">
    <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">DP / Uang Muka</span>
    <span style="font-size:16px; color:#ffb4ab">- Rp${paid.toLocaleString('id-ID')}</span>
  </div>` : '';

  const discountRow = discountAmount > 0 ? `
  <div style="display:flex; justify-content:space-between">
    <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">Diskon</span>
    <span style="font-size:16px; color:#ffb4ab">- Rp${discountAmount.toLocaleString('id-ID')}</span>
  </div>` : '';

  return `<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@100..900&family=Manrope:wght@200..800&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { margin: 0; size: A4; }
    html { background: #131313; -webkit-print-color-adjust: exact; }
    body { background: #131313; color: #e5e2e1; font-family: 'Manrope', sans-serif; padding: 0; width: 794px; margin: 0 auto; }
    .page-wrap { padding: 40px; background: #131313; }
    .margin-top, .margin-bottom { height: 40px; background: #131313; }
    .font-headline { font-family: 'League Spartan', sans-serif; }
    .text-yellow { color: #FFFF00; }
    .bg-dark { background: #1c1b1b; }
    .bg-darker { background: #0e0e0e; }
    .text-muted { color: #cac8aa; }
    .border-yellow { border-left: 2px solid #FFFF00; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table thead { display: table-header-group; }
    .item-row td { padding: 28px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
    .item-row:last-child td { border-bottom: none; }
    .totals-section { page-break-inside: avoid; }
  </style>
</head>
<body>
  <table style="width:100%; border-collapse:collapse; background:#131313;">
    <thead><tr><td class="margin-top"></td></tr></thead>
    <tbody><tr><td style="padding: 0 40px; background:#131313;">
    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:60px">
      <div>
        <h1 class="font-headline" style="font-size:48px; font-weight:900; line-height:0.8; text-transform:uppercase; margin-bottom:16px">
          ${documentType === 'tanda_terima' ? 'Receipt' : documentType === 'bukti_bayar' ? 'Payment' : 'Invoice'}<br/>
          <span class="text-yellow">Repaint &<br/>Detailing</span>
        </h1>
        <div style="display:flex; gap:12px; margin-top:16px">
          <span style="background:#676700; color:#e6e67a; padding:4px 12px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em">
            Status: ${paid >= subtotal ? 'Lunas' : paid > 0 ? 'DP' : 'Belum Bayar'}
          </span>
        </div>
      </div>
      <div style="text-align:right">
        <div>
          <p class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Nomor Dokumen</p>
          <p class="font-headline text-yellow" style="font-size:28px; font-weight:700">#BS-${docNumber || 'PREVIEW'}</p>
        </div>
        <div style="margin-top:16px">
          <p class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Tanggal Terbit</p>
          <p style="font-size:16px; font-weight:500">${now ? now.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' }) : '-'}</p>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1px; background:#484831; margin-bottom:60px">
      <div class="bg-dark" style="padding:28px">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:20px">Informasi Pelanggan</p>
        <p class="font-headline" style="font-size:24px; font-weight:700; text-transform:uppercase; margin-bottom:8px">${customerName || '-'}</p>
        <p class="text-muted" style="font-size:14px; line-height:1.8">
          WhatsApp: ${displayPhone}<br/>
          Kendaraan: ${motorDetails || '-'}
        </p>
      </div>
      <div class="bg-dark" style="padding:28px">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:20px">Studio Layanan</p>
        <p class="font-headline" style="font-size:24px; font-weight:700; text-transform:uppercase; margin-bottom:8px">BOSMAT STUDIO</p>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr style="border-bottom:1px solid #484831;">
          <th style="width:50%; text-align:left; padding-bottom:12px"><span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Deskripsi Layanan</span></th>
          <th style="width:10%; text-align:center; padding-bottom:12px"><span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Jml</span></th>
          <th style="width:20%; text-align:right; padding-bottom:12px"><span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Harga</span></th>
          <th style="width:20%; text-align:right; padding-bottom:12px"><span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Total</span></th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || '<tr><td colspan="4" style="text-align:center; padding:40px; color:#666;">Belum ada layanan ditambahkan</td></tr>'}
      </tbody>
    </table>

  <div class="totals-section" style="display:grid; grid-template-columns:7fr 5fr; gap:32px; margin-top:40px">
    <div>
      <div style="padding:24px; border:1px solid #484831; background:#1c1b1b">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:16px">Informasi Pembayaran</p>
        <div style="display:flex; align-items:center; gap:16px">
          <div style="background:rgba(255,255,255,0.05); padding:12px; display:flex; align-items:center; justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 21H21M3 10H21M5 6L12 3L19 6M4 10V21M8 10V21M12 10V21M16 10V21M20 10V21" stroke="#FFFF00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div>
            <p class="font-headline" style="font-size:18px; font-weight:700; text-transform:uppercase">Blu BCA Digital: 0901 1180 1695</p>
            <p class="text-muted" style="font-size:13px; text-transform:uppercase">A/N Muhammad Tauhid Haryadesa</p>
          </div>
        </div>
      </div>
    </div>

    <div style="background:#2a2a2a; padding:40px; display:flex; flex-direction:column; gap:20px">
      <div style="display:flex; justify-content:space-between">
        <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">Subtotal</span>
        <span style="font-size:16px">Rp${subtotal.toLocaleString('id-ID')}</span>
      </div>
      ${discountRow}
      ${dpRow}
      <div style="border-top:1px solid #484831; padding-top:24px; margin-top:8px">
        <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:8px">Total Keseluruhan</span>
        <span class="font-headline" style="font-size:36px; font-weight:900">Rp${(subtotal - discountAmount).toLocaleString('id-ID')}</span>
      </div>
      <div style="background:#FFFF00; padding:20px 24px; margin:0 -40px -40px; display:flex; justify-content:space-between; align-items:center">
        <div>
          <span style="color:#1d1d00; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:4px">Sisa Tagihan</span>
          <span class="font-headline" style="color:#1d1d00; font-size:44px; font-weight:900">Rp${balance.toLocaleString('id-ID')}</span>
        </div>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#1d1d00" stroke-width="2"/><path d="M2 10H22" stroke="#1d1d00" stroke-width="2"/><path d="M6 15H10" stroke="#1d1d00" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
    </div>
    </div>
      </td></tr></tbody>
    <tfoot><tr><td class="margin-bottom"></td></tr></tfoot>
  </table>
</body>
</html>`;
}

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

