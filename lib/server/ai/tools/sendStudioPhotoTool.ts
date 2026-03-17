/**
 * sendStudioPhotoTool — Vercel Override
 * Mengirim foto studio Bosmat via Fonnte sendMedia() (URL publik)
 * Menggantikan implementasi asli yang pakai wppconnect (tidak support serverless)
 */

import { sendMedia } from '@/lib/server/fonnte-client';

const DEFAULT_CAPTION =
  'Bosmat Repaint Detailing Motor, Bukit Cengkeh 1, Jl. Medan No.B3/2, Kota Depok, Jawa Barat 16451. Mohon kabari sebelum tiba agar tim siap menyambut.';

export const sendStudioPhotoTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'sendStudioPhoto',
      description:
        'Kirim foto eksterior Bosmat (berlokasi di Bukit Cengkeh 1, Jl. Medan No.B3/2, Kota Depok, Jawa Barat 16451) ke pelanggan via WhatsApp. Gunakan saat pelanggan sulit menemukan lokasi.',
      parameters: {
        type: 'object',
        properties: {
          caption: {
            type: 'string',
            description: 'Caption opsional yang akan disertakan bersama foto.',
          },
        },
      },
    },
  },
  implementation: async (input: { caption?: string; senderNumber?: string }) => {
    const studioPhotoUrl = process.env.STUDIO_PHOTO_URL;
    const senderNumber = input.senderNumber;

    if (!studioPhotoUrl) {
      return {
        success: false,
        message: 'STUDIO_PHOTO_URL belum dikonfigurasi.',
      };
    }

    if (!senderNumber) {
      return {
        success: false,
        message: '[sendStudioPhoto] senderNumber wajib tersedia untuk mengirim foto.',
      };
    }

    const caption =
      input.caption && input.caption.trim().length > 0
        ? input.caption.trim()
        : DEFAULT_CAPTION;

    // Normalize: hapus @c.us / @g.us suffix, kirim nomor bersih ke Fonnte
    const cleanNumber = senderNumber
      .replace(/@c\.us$/, '')
      .replace(/@g\.us$/, '')
      .replace(/\D/g, '');

    try {
      await sendMedia(cleanNumber, studioPhotoUrl, 'bosmat-studio.jpg', caption);
      return {
        success: true,
        message: 'Foto studio berhasil dikirim.',
        data: { senderNumber: cleanNumber, caption },
      };
    } catch (error: any) {
      console.error('[sendStudioPhotoTool] Error:', error.message);
      return {
        success: false,
        message: `Gagal mengirim foto studio: ${error.message}`,
      };
    }
  },
};
