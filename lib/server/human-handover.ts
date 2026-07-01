/**
 * Human Handover / Snooze Mode
 * Controls AI pause/resume per conversation
 * 
 * UNIFIED: Uses Prisma (same DB as backend) instead of Firestore.
 * This ensures admin dashboard toggles are respected by the message handler.
 */

import prisma from '@/lib/prisma';

/**
 * Normalize WhatsApp number to standard identifier format.
 * Mirrors getIdentifier() from src/ai/utils/humanHandover.js
 */
function getIdentifier(number: string): string | null {
  if (!number) return null;
  const trimmed = number.trim();
  if (!trimmed) return null;

  // If already has suffix, keep it
  if (trimmed.endsWith('@c.us') || trimmed.endsWith('@lid')) {
    return trimmed;
  }

  // Strip non-digits, normalize 0 prefix to 62
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);

  return `${digits}@c.us`;
}

// --- Snooze Mode ---

export async function setSnoozeMode(
  senderNumber: string,
  durationMinutes = 60,
  options: { reason?: string; manual?: boolean } = {}
) {
  const { reason = null, manual = false } = options;
  const identifier = getIdentifier(senderNumber) || senderNumber;
  const phone = identifier.replace(/@c\.us$|@lid$/, '');

  let expiresAtDate: Date | null = null;

  if (!manual) {
    const effectiveDuration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;
    expiresAtDate = new Date(Date.now() + effectiveDuration * 60 * 1000);
  }

  // 1. Update HandoverSnooze table
  await prisma.handoverSnooze.upsert({
    where: { id: identifier },
    update: {
      expiresAt: expiresAtDate,
      manual,
      reason,
      createdAt: new Date(),
    },
    create: {
      id: identifier,
      customerId: phone,
      expiresAt: expiresAtDate,
      manual,
      reason,
    }
  });

  // 2. Sync to Customer table
  try {
    let customer = await prisma.customer.findUnique({ where: { phone } });
    if (!customer && identifier.endsWith('@lid')) {
      customer = await prisma.customer.findFirst({ where: { whatsappLid: identifier } });
    }
    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          aiPaused: true,
          aiPausedUntil: expiresAtDate,
          aiPauseReason: reason || (manual ? 'manual-toggle' : 'timed-toggle'),
          updatedAt: new Date(),
        }
      });
    }
  } catch (err: any) {
    console.warn('[Handover] Failed to sync snooze to Customer:', err.message);
  }

  console.log(`[Handover] Snooze ON for ${identifier}`, manual ? '(manual)' : `(${durationMinutes}min)`);
}

export async function clearSnoozeMode(senderNumber: string) {
  const identifier = getIdentifier(senderNumber) || senderNumber;
  const phone = identifier.replace(/@c\.us$|@lid$/, '');

  try {
    // Delete by exact ID match
    await prisma.handoverSnooze.deleteMany({ where: { id: identifier } });
    
    // Also delete by customerId (phone) — catches records stored under LID
    await prisma.handoverSnooze.deleteMany({ where: { customerId: phone } });
    
    // If we got a @c.us identifier, also check if customer has a LID and delete that too
    if (identifier.endsWith('@c.us')) {
      try {
        const customer = await prisma.customer.findUnique({ where: { phone } });
        if (customer?.whatsappLid) {
          await prisma.handoverSnooze.deleteMany({ where: { id: customer.whatsappLid } });
        }
      } catch {
        // Ignored
      }
    }

    // Sync to Customer table
    try {
      let customer = await prisma.customer.findUnique({ where: { phone } });
      if (!customer && identifier.endsWith('@lid')) {
        customer = await prisma.customer.findFirst({ where: { whatsappLid: identifier } });
      }
      if (customer) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            aiPaused: false,
            aiPausedUntil: null,
            aiPauseReason: null,
            updatedAt: new Date(),
          }
        });
      }
    } catch {
      // Ignored
    }
    console.log(`[Handover] Snooze OFF for ${identifier}`);
  } catch (err: any) {
    console.warn('[Handover] Failed to clear snooze:', err.message);
  }
}

export interface SnoozeInfo {
  active: boolean;
  manual: boolean;
  expiresAt: string | null;
  reason: string | null;
}

export async function getSnoozeInfo(
  senderNumber: string,
  options: { cleanExpired?: boolean } = {}
): Promise<SnoozeInfo> {
  const identifier = getIdentifier(senderNumber) || senderNumber;

  try {
    const snooze = await prisma.handoverSnooze.findUnique({
      where: { id: identifier }
    });

    if (!snooze) {
      return { active: false, manual: false, expiresAt: null, reason: null };
    }

    const { manual, expiresAt, reason } = snooze;
    const now = new Date();

    let active = manual;
    if (!manual) {
      if (expiresAt && expiresAt > now) {
        active = true;
      } else {
        active = false;
        if (options.cleanExpired) {
          await clearSnoozeMode(senderNumber);
        }
      }
    }

    return {
      active,
      manual,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      reason: reason || null,
    };
  } catch (error: any) {
    console.error('[Handover] Error getting snooze info:', error);
    return { active: false, manual: false, expiresAt: null, reason: null };
  }
}

export async function isSnoozeActive(senderNumber: string): Promise<boolean> {
  const info = await getSnoozeInfo(senderNumber, { cleanExpired: true });
  return info.active;
}
