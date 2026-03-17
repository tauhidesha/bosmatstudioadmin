import { NextRequest, NextResponse } from 'next/server';
import { sendText } from '@/lib/server/fonnte-client';
import {
  saveMessageToFirestore,
  saveSenderMeta,
  normalizeWhatsappNumber,
} from '@/lib/server/firebase-admin';
import {
  isSnoozeActive,
  getSnoozeInfo,
  clearSnoozeMode,
} from '@/lib/server/human-handover';
import {
  appendMessage,
  waitAndFlush,
  BufferedMessage,
} from '@/lib/server/debounce-firestore';
import { getAIResponse } from '@/lib/server/ai/engine';
import { extractAndSaveContext } from '@/lib/server/ai/context-extractor';
import { classifyAndSaveCustomer } from '@/lib/server/ai/customer-classifier';
import { updateSignalsOnIncomingMessage } from '@/lib/server/ai/signal-tracker';

export const runtime = 'nodejs';

const MAX_MESSAGES_BUFFER = 20;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('[Webhook] RAW FONNTE PAYLOAD:', JSON.stringify(payload, null, 2));

    // Fonnte webhook payload:
    // device, sender, message, text, member, name, location, url, filename, extension
    const sourceNumber = payload.sender;
    const senderName = payload.name;
    const body = payload.message || payload.text || '';
    const mediaUrl = payload.url;
    const mediaExtension = payload.extension;

    // Reject status updates
    if (!sourceNumber || sourceNumber === 'status@broadcast') {
      return NextResponse.json({ status: 'ignored' });
    }

    // Reject empty messages UNLESS they have media
    if (!body && !mediaUrl) {
      return NextResponse.json({ status: 'ignored', reason: 'empty text and no media' });
    }

    // If Fonnte sends "non-text message" as body but has media, clear the body text
    let finalBody = body;
    if (body === 'non-text message' && mediaUrl) {
      finalBody = '';
    }

    const senderNumber = normalizeWhatsappNumber(sourceNumber);
    if (!senderNumber) {
      return NextResponse.json({ status: 'invalid_sender' });
    }

    // Normalize to digits-only for comparison (senderNumber has @c.us suffix)
    const senderDigits = senderNumber.replace(/\D/g, '');
    const adminNumbers = [
      process.env.BOSMAT_ADMIN_NUMBER,
      process.env.ADMIN_WHATSAPP_NUMBER,
    ].filter(Boolean).map(n => n!.replace(/\D/g, ''));

    const isAdmin = adminNumbers.some(n => n === senderDigits);

    // 1. Save metadata
    if (senderName) {
      await saveSenderMeta(senderNumber, senderName);
    }

    // 2. Format as BufferedMessage
    const msgObj: BufferedMessage = {
      content: finalBody,
      isMedia: !!mediaUrl,
      mediaUrl: mediaUrl,
      mediaExtension: mediaExtension,
      timestamp: new Date().toISOString(),
    };

    // 3. Admin — bypass debounce & snooze, process immediately
    if (isAdmin) {
      await saveMessageToFirestore(senderNumber, finalBody, 'admin');

      // Admin command: /resume atau /snoozeoff <nomor>
      if (finalBody.startsWith('/resume ') || finalBody.startsWith('/snoozeoff ')) {
        const targetNumber = finalBody.split(' ')[1];
        if (targetNumber) {
          await clearSnoozeMode(targetNumber);
          return NextResponse.json({ status: 'admin_command_processed' });
        }
      }

      return await processAndRespond(senderNumber, [msgObj], senderName, true);
    }

    // 4. Save customer message to Firestore
    await saveMessageToFirestore(senderNumber, finalBody, 'user');

    // 5. Check Snooze / Human Handover
    const isPaused = await isSnoozeActive(senderNumber);
    if (isPaused) {
      console.log(`[Webhook] Message from ${senderNumber} ignored (Snooze Active)`);
      return NextResponse.json({ status: 'snoozed' });
    }

    // Clean expired snooze
    await getSnoozeInfo(senderNumber, { cleanExpired: true });

    // 6. Debounce queue
    const { shouldProcess, messages } = await appendMessage(senderNumber, msgObj);

    // Force process jika buffer penuh
    if (messages.length > MAX_MESSAGES_BUFFER || shouldProcess) {
      return await processAndRespond(senderNumber, messages, senderName, false);
    }

    // Wait for debounce window
    const finalMessages = await waitAndFlush(senderNumber);
    if (finalMessages && finalMessages.length > 0) {
      return await processAndRespond(senderNumber, finalMessages, senderName, false);
    }

    // Lain sender akan handle flush
    return NextResponse.json({ status: 'debouncing' });

  } catch (error: any) {
    console.error('[Webhook] Fonnte Payload Error:', error);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}

/**
 * Process buffered messages via LangChain engine dan kirim response via Fonnte
 * Menggantikan triggerAdkProcessing()
 */
async function processAndRespond(
  senderNumber: string,
  messages: BufferedMessage[],
  senderName?: string,
  isAdminOverride?: boolean
): Promise<NextResponse> {
  try {
    // Gabungkan semua teks pesan
    let combinedContent = '';
    let mediaUrl: string | undefined;
    let mediaExtension: string | undefined;

    for (const msg of messages) {
      if (msg.content) {
        combinedContent += msg.content + '\n';
      }
      // Ambil media pertama yang ditemukan
      if (msg.isMedia && msg.mediaUrl && !mediaUrl) {
        mediaUrl = msg.mediaUrl;
        mediaExtension = msg.mediaExtension;
      }
    }

    const messageText = combinedContent.trim();

    console.log(`[Webhook] Processing ${messages.length} msg(s) from ${senderNumber}`, {
      hasMedia: !!mediaUrl,
      messagePreview: messageText.substring(0, 50),
    });

    const result = await getAIResponse({
      message: messageText,
      senderNumber,
      senderName,
      isAdminOverride,
      mediaUrl,
      mediaExtension,
    });

    const aiResponse = result.response;

    if (aiResponse) {
      // Kirim response ke user via Fonnte
      await sendText(senderNumber, aiResponse);
      // Simpan ke Firestore
      await saveMessageToFirestore(senderNumber, aiResponse, 'ai');

      // Background: context extraction → classification → signal tracking
      // MUST await — Vercel kills fire-and-forget promises after response is sent
      if (!result.isAdmin) {
        const msgForExtraction = combinedContent.trim();
        try {
          await extractAndSaveContext(msgForExtraction, aiResponse, senderNumber);
          await classifyAndSaveCustomer(senderNumber);
        } catch (err: any) {
          console.warn('[Webhook] Background extraction error:', err.message);
        }

        try {
          await updateSignalsOnIncomingMessage(senderNumber, combinedContent);
        } catch (err: any) {
          console.warn('[Webhook] Signal tracker error:', err.message);
        }
      }
    }

    return NextResponse.json({
      status: 'processed',
      toolsCalled: result.toolsCalled,
    });

  } catch (err: any) {
    console.error('[Webhook] LangChain Processing failed:', err.message);
    return NextResponse.json(
      { status: 'error', reason: 'ai_failed', details: err.message },
      { status: 500 }
    );
  }
}
