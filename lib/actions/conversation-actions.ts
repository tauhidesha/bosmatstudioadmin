'use server';

import { setSnoozeMode, clearSnoozeMode } from '@/lib/server/human-handover';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Resolves the correct HandoverSnooze identifier for a customer.
 * 
 * Problem: HandoverSnooze records can be stored under either:
 *   - "628xxx@c.us" (phone-based)
 *   - "4570264641602@lid" (LID-based)
 * 
 * The admin dashboard only knows the plain phone number "628xxx".
 * We must check the Customer table for a whatsappLid and try both.
 */
async function resolveSnoozeIdentifiers(number: string): Promise<string[]> {
  const identifiers: string[] = [];
  
  // 1. Always try phone-based identifier
  const digits = number.replace(/\D/g, '').replace(/^0/, '62');
  identifiers.push(`${digits}@c.us`);
  
  // 2. Look up customer for whatsappLid
  try {
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { phone: digits },
          { phone: number },
          { whatsappLid: number.includes('@') ? number : undefined },
        ].filter(c => c.phone !== undefined || c.whatsappLid !== undefined)
      },
      select: { whatsappLid: true, phone: true }
    });
    
    for (const customer of customers) {
      if (customer.whatsappLid) {
        identifiers.push(customer.whatsappLid);
      }
    }
  } catch (err) {
    console.warn('[toggleAiState] Failed to look up customer LID:', err);
  }
  
  return [...new Set(identifiers)]; // dedupe
}

export async function toggleAiStateAction(number: string, enabled: boolean, reason?: string) {
  try {
    if (!number) {
      return { success: false, error: 'Nomor WhatsApp tidak valid' };
    }

    const identifiers = await resolveSnoozeIdentifiers(number);
    console.log(`[toggleAiState] number=${number}, enabled=${enabled}, identifiers=${identifiers.join(', ')}`);

    if (enabled) {
      // Clear ALL possible snooze records (both @c.us and @lid)
      for (const id of identifiers) {
        await clearSnoozeMode(id);
      }
      
      // Also directly update the Customer table as a safety net
      const digits = number.replace(/\D/g, '').replace(/^0/, '62');
      await prisma.customer.updateMany({
        where: {
          OR: [
            { phone: digits },
            { phone: number },
          ]
        },
        data: {
          aiPaused: false,
          aiPausedUntil: null,
          aiPauseReason: null,
          updatedAt: new Date(),
        }
      });
    } else {
      // Set snooze using the primary identifier
      await setSnoozeMode(identifiers[0], 60, { manual: true, reason });
      
      // If there's a LID, also set snooze for LID
      if (identifiers.length > 1) {
        await setSnoozeMode(identifiers[1], 60, { manual: true, reason });
      }
    }

    // Revalidate paths that might display AI state
    revalidatePath('/conversations');

    return {
      success: true,
      state: {
        aiEnabled: enabled,
        aiPaused: !enabled
      }
    };
  } catch (error: any) {
    console.error(`Error updating AI state for ${number}:`, error);
    return { success: false, error: error.message || 'Internal server error' };
  }
}

export async function updateConversationLabelAction(conversationId: string, label: string, reason?: string) {
  try {
    if (!conversationId) {
      return { success: false, error: 'Conversation ID tidak valid' };
    }

    await prisma.customer.update({
      where: { id: conversationId },
      data: {
        status: label,
        aiPauseReason: reason || undefined, // Store reason if provided
      }
    });

    // Revalidate paths
    revalidatePath('/conversations');

    return { success: true };
  } catch (error: any) {
    console.error(`Error updating label for ${conversationId}:`, error);
    return { success: false, error: error.message || 'Internal server error' };
  }
}

export async function toggleFollowUpStateAction(customerIdOrPhone: string, enabled: boolean) {
  try {
    if (!customerIdOrPhone) {
      return { success: false, error: 'Customer ID / Phone tidak valid' };
    }

    const digits = customerIdOrPhone.replace(/\D/g, '').replace(/^0/, '62');

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: customerIdOrPhone },
          { phone: digits },
          { phone: customerIdOrPhone },
        ]
      }
    });

    if (!customer) {
      return { success: false, error: 'Customer tidak ditemukan' };
    }

    const existingContext = await prisma.customerContext.findFirst({
      where: {
        OR: [
          { id: customer.id },
          { phone: customer.phone },
        ]
      }
    });

    if (existingContext) {
      await prisma.customerContext.update({
        where: { id: existingContext.id },
        data: {
          followUpStrategy: enabled ? null : 'stop',
          ...(enabled ? { followUpCount: 0 } : {}),
          labelReason: enabled ? 'manual_followup_on' : 'manual_followup_off',
          updatedAt: new Date(),
        }
      });
    } else {
      await prisma.customerContext.create({
        data: {
          id: customer.id,
          phone: customer.phone,
          followUpStrategy: enabled ? null : 'stop',
          labelReason: enabled ? 'manual_followup_on' : 'manual_followup_off',
          updatedAt: new Date(),
        }
      });
    }

    revalidatePath('/conversations');

    return {
      success: true,
      followUpEnabled: enabled,
    };
  } catch (error: any) {
    console.error(`Error updating Follow Up state for ${customerIdOrPhone}:`, error);
    return { success: false, error: error.message || 'Internal server error' };
  }
}
