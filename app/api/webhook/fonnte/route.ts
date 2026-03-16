import { NextRequest, NextResponse } from 'next/server';
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

// Limit maximum messages per sender to prevent spam/abuse
const MAX_MESSAGES_BUFFER = 20;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Fonnte webhook payload structure:
    // device, sender, message, text, member, name, location, pollname, choices, url, filename, extension
    const sourceNumber = payload.sender;
    const senderName = payload.name;
    const body = payload.message || payload.text || '';
    const mediaUrl = payload.url;
    const mediaExtension = payload.extension;

    // Reject status updates or empty messages
    if (!sourceNumber || sourceNumber === 'status@broadcast') {
      return NextResponse.json({ status: 'ignored' });
    }

    const senderNumber = normalizeWhatsappNumber(sourceNumber);
    if (!senderNumber) {
      return NextResponse.json({ status: 'invalid_sender' });
    }

    // Determine if it's admin (BosMat account)
    const isAdmin = senderNumber === process.env.BOSMAT_ADMIN_NUMBER 
      || senderNumber === process.env.ADMIN_WHATSAPP_NUMBER;

    // 1. Save metadata
    if (senderName) {
      await saveSenderMeta(senderNumber, senderName);
    }

    // 2. Format as BufferedMessage
    const msgObj: BufferedMessage = {
      content: body,
      isMedia: !!mediaUrl,
      mediaUrl: mediaUrl,
      mediaExtension: mediaExtension,
      timestamp: new Date().toISOString(),
    };

    // 3. Admin commands (instant processing)
    if (isAdmin) {
      // Admin processing bypasses debounce and snooze
      await saveMessageToFirestore(senderNumber, body, 'admin');
      
      // If admin types a command like "/resume 628123...", clear snooze
      if (body.startsWith('/resume ') || body.startsWith('/snoozeoff ')) {
        const targetNumber = body.split(' ')[1];
        if (targetNumber) {
          await clearSnoozeMode(targetNumber);
          return NextResponse.json({ status: 'admin_command_processed' });
        }
      }

      // Forward admin message directly to ADK
      await triggerAdkProcessing(senderNumber, [msgObj], senderName);
      return NextResponse.json({ status: 'admin_processed' });
    }

    // 4. Save to Firestore (Customer)
    await saveMessageToFirestore(senderNumber, body, 'user');

    // 5. Check Snooze / Human Handover
    const isPaused = await isSnoozeActive(senderNumber);
    if (isPaused) {
      console.log(`[Webhook] Message from ${senderNumber} ignored (Snooze Active)`);
      return NextResponse.json({ status: 'snoozed' });
    }

    // Wake-up logic: clear expired snooze (though getSnoozeInfo cleanExpired=true does this)
    await getSnoozeInfo(senderNumber, { cleanExpired: true });

    // 6. Add to Debounce Queue
    const { shouldProcess, messages } = await appendMessage(senderNumber, msgObj);

    // If buffer is too full, force process to avoid massive payloads
    if (messages.length > MAX_MESSAGES_BUFFER || shouldProcess) {
      return await flushAndProcess(senderNumber, messages, senderName);
    }

    // Wait for the debounce window to close
    // Since Vercel has a 10s-60s timeout limit, we can't wait indefinitely
    // waitAndFlush waits DEBOUNCE_MS (default 10s) and then checks
    const finalMessages = await waitAndFlush(senderNumber);
    if (finalMessages && finalMessages.length > 0) {
      return await flushAndProcess(senderNumber, finalMessages, senderName);
    }

    // If waitAndFlush returns null, it means another message came in and reset the timer.
    // That subsequent request will handle the flushing.
    return NextResponse.json({ status: 'debouncing' });

  } catch (error: any) {
    console.error('[Webhook] Fonnte Payload Error:', error);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}

/**
 * Trigger ADK microservice with buffered messages
 */
async function flushAndProcess(
  senderNumber: string,
  messages: BufferedMessage[],
  senderName?: string
) {
  // We use triggerAdkProcessing locally, and respond to Fonnte immediately
  // Note: On Vercel, background tasks might be killed if the response completes.
  // Best practice in Next.js on Vercel is to await critical tasks, 
  // or use waitUntil() if experimental features are enabled.
  try {
    const result = await triggerAdkProcessing(senderNumber, messages, senderName);
    return NextResponse.json({ status: 'processed', ai_result: result });
  } catch (err: any) {
    console.error('[Webhook] ADK Processing failed:', err.message);
    return NextResponse.json({ status: 'error', reason: 'adk_failed' }, { status: 500 });
  }
}

/**
 * Call the Python ADK Service
 */
async function triggerAdkProcessing(
  senderNumber: string,
  messages: BufferedMessage[],
  senderName?: string
) {
  const adkUrl = process.env.ADK_SERVICE_URL || 'http://localhost:8000';
  
  // Format messages into a single string, or handle media
  let combinedContent = '';
  const mediaItems: Array<{ url: string; extension?: string }> = [];

  for (const msg of messages) {
    if (msg.content) {
      combinedContent += msg.content + '\n';
    }
    if (msg.isMedia && msg.mediaUrl) {
      mediaItems.push({
        url: msg.mediaUrl,
        extension: msg.mediaExtension
      });
    }
  }

  const payload = {
    senderNumber,
    senderName,
    message: combinedContent.trim(),
    mediaItems,
  };

  console.log(`[Webhook] Forwarding to ADK: ${senderNumber} (${messages.length} msgs)`);

  const res = await fetch(`${adkUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`ADK Error: ${res.statusText}`);
  }

  return await res.json();
}
