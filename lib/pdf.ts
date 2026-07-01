import generateInvoiceHTML from './templates/invoiceTemplate';
import { generateWarrantyHTML } from './templates/warrantyTemplate';

export async function generateBase64PDF(htmlContent: string): Promise<string> {
  // We dynamically import html2pdf in the client side
  const html2pdf = (await import('html2pdf.js')).default;
  
  const opt = {
    margin:       0,
    filename:     'document.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  const worker = html2pdf().set(opt).from(htmlContent);
  const pdfBase64 = await worker.outputPdf('datauristring');
  
  // The output is "data:application/pdf;base64,xxxx"
  // We need to return only the base64 part
  return pdfBase64.split(',')[1];
}

export { generateInvoiceHTML, generateWarrantyHTML };
