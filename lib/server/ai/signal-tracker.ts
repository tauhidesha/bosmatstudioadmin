/**
 * Signal Tracker — fire & forget, dipanggil tiap pesan masuk dari customer
 * Diport dari src/ai/agents/followUpEngine/signalTracker.js
 */

import { getDb } from '@/lib/server/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const STOP_KEYWORDS = [
  'stop', 'jangan', 'tidak usah', 'ga usah',
  'hapus', 'unsubscribe', 'berhenti', 'ganggu',
  'spam', 'blokir',
];

/**
 * Update signals saat customer kirim pesan.
 * Fire & forget — tidak blocking reply.
 */
export async function updateSignalsOnIncomingMessage(
  senderNumber: string,
  messageText: string
): Promise<void> {
  const docId = (senderNumber || '').replace(/\D/g, '');
  if (!docId) return;
  if (senderNumber === 'playground' || senderNumber === 'unknown') return;

  const db = getDb();
  const ref = db.collection('customerContext').doc(docId);

  try {
    const doc = await ref.get();
    if (!doc.exists) return;

    const context = doc.data() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    // 1. Customer balas setelah di-follow up
    if (context.last_followup_at && !context.replied_after_followup) {
      const lastFollowUp = parseDateField(context.last_followup_at);
      const lastReply = parseDateField(context.last_customer_reply_at);

      if (!lastReply || (lastFollowUp && lastFollowUp > lastReply)) {
        updates.replied_after_followup = true;
        updates.followup_reply_at = FieldValue.serverTimestamp();
        console.log(`[SignalTracker] ${docId} replied after follow up`);
      }
    }

    // 2. Detect explicit stop request
    const lowerMsg = (messageText || '').toLowerCase();
    const isStopRequest = STOP_KEYWORDS.some((k) => lowerMsg.includes(k));
    if (isStopRequest) {
      updates.explicitly_rejected = true;
      updates.follow_up_strategy = 'stop';
      updates.rejected_at = FieldValue.serverTimestamp();
      console.log(`[SignalTracker] ${docId} explicitly rejected follow up`);
    }

    // 3. Track last customer reply timestamp
    updates.last_customer_reply_at = FieldValue.serverTimestamp();

    if (Object.keys(updates).length > 0) {
      await ref.set(updates, { merge: true });
    }
  } catch (error: any) {
    console.warn('[SignalTracker] Error:', error.message);
    // Fire-and-forget: jangan re-throw
  }
}

/**
 * Mark customer sebagai converted (booking/bayar setelah follow up).
 */
export async function markAsConverted(senderNumber: string): Promise<void> {
  const docId = (senderNumber || '').replace(/\D/g, '');
  if (!docId) return;

  const db = getDb();
  await db.collection('customerContext').doc(docId).set({
    followup_converted: true,
    converted_at: FieldValue.serverTimestamp(),
    customer_label: 'existing',
    follow_up_strategy: 'retention',
    label_reason: 'converted after follow up',
    labeled_by: 'signal_tracker',
    label_updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`[SignalTracker] ${docId} marked as converted`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDateField(val: unknown): Date | null {
  if (!val) return null;
  if (typeof (val as any).toDate === 'function') return (val as any).toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
