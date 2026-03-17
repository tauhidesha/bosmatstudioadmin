/**
 * triggerBosMatTool — Vercel Version
 * Escalate ke BosMat via Fonnte (human handover) + set snooze
 */

import { sendText } from '@/lib/server/fonnte-client';
import { setSnoozeMode } from '@/lib/server/human-handover';

const BOSMAT_ADMIN_NUMBER = process.env.BOSMAT_ADMIN_NUMBER || '';

export const triggerBosMatTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'triggerBosMatTool',
      description:
        'Digunakan saat Zoya butuh bantuan BosMat karena tidak yakin jawabannya atau pertanyaannya terlalu spesifik.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description:
              'Alasan Zoya perlu tanya ke BosMat (misalnya: warna efek custom, motor langka, dsb)',
          },
          customerQuestion: {
            type: 'string',
            description:
              'Pertanyaan asli dari customer yang perlu ditanyain ke BosMat',
          },
        },
        required: ['reason', 'customerQuestion'],
      },
    },
  },
  implementation: async (input: {
    reason: string;
    customerQuestion: string;
    senderNumber?: string;
    senderName?: string;
  }) => {
    try {
      const { reason, customerQuestion, senderNumber, senderName } = input;

      if (!senderNumber) {
        throw new Error('[triggerBosMatTool] senderNumber wajib tersedia untuk handover.');
      }

      // Set snooze so bot doesn't respond while human handles it
      await setSnoozeMode(senderNumber);

      // Notify BosMat via Fonnte
      if (BOSMAT_ADMIN_NUMBER) {
        const notifMsg =
          `🚨 *ALERT: Handover ke BosMat*\n\n` +
          `👤 Customer: ${senderName || senderNumber} (${senderNumber})\n` +
          `📋 Alasan: ${reason}\n` +
          `💬 Pertanyaan: ${customerQuestion}\n\n` +
          `_Bot sudah di-pause untuk nomor ini. Balas langsung ke customer._`;

        await sendText(BOSMAT_ADMIN_NUMBER, notifMsg);
      }

      return {
        success: true,
        message: `Notifikasi untuk menanyakan "${customerQuestion}" telah berhasil dikirim ke BosMat.`,
      };
    } catch (error: any) {
      console.error('[triggerBosMatTool] Error:', error);
      return { success: false, message: error.message };
    }
  },
};
