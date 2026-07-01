'use server';

import { setSnoozeMode, clearSnoozeMode } from '@/lib/server/human-handover';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function toggleAiStateAction(number: string, enabled: boolean, reason?: string) {
  try {
    if (!number) {
      return { success: false, error: 'Nomor WhatsApp tidak valid' };
    }

    if (enabled) {
      await clearSnoozeMode(number);
    } else {
      await setSnoozeMode(number, 60, { manual: true, reason });
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
