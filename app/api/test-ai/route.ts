import { NextRequest, NextResponse } from 'next/server';
import { getAIResponse } from '@/lib/server/ai/engine';
import { extractAndSaveContext } from '@/lib/server/ai/context-extractor';
import { classifyAndSaveCustomer } from '@/lib/server/ai/customer-classifier';

export const runtime = 'nodejs';

/**
 * Test AI endpoint for the admin playground
 * Langsung panggil LangChain engine — tanpa proxy ke ADK
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history, mode, media, model_override } = body;

    if (!message && (!media || media.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Pesan atau media wajib diisi' },
        { status: 400 }
      );
    }

    // Build providedHistory dari format playground [{role, content}]
    const providedHistory = (history || []).map((h: { role: string; content: string }) => ({
      role: h.role === 'assistant' || h.role === 'ai' ? 'ai' : 'human',
      content: h.content,
    }));

    // Extract media info jika ada (playground kirim base64 atau URL)
    const firstMedia = media?.[0] ?? null;
    const mediaUrl = firstMedia?.url ?? null;
    const mediaExtension = firstMedia?.extension ?? firstMedia?.mimeType?.split('/')?.[1] ?? null;

    const isAdminOverride = mode === 'admin' ? true : mode === 'customer' ? false : undefined;

    console.log(`[Test-AI] mode=${mode}, message="${message?.substring(0, 50)}", mediaUrl=${mediaUrl ?? 'none'}`);

    const playgroundDocId = 'playground_test';

    const result = await getAIResponse({
      message: message || '',
      senderNumber: playgroundDocId,
      senderName: 'Admin Playground',
      isAdminOverride,
      mediaUrl: mediaUrl ?? undefined,
      mediaExtension: mediaExtension ?? undefined,
      providedHistory,
    });

    // Await context extraction for playground testing
    try {
      await extractAndSaveContext(message || '', result.response, playgroundDocId);
      await classifyAndSaveCustomer(playgroundDocId);
    } catch (err: any) {
      console.warn('[Test-AI] Background extraction error:', err.message);
    }

    return NextResponse.json({
      success: true,
      response: result.response,
      isAdmin: result.isAdmin,
      toolsCalled: result.toolsCalled,
    });

  } catch (error: any) {
    console.error('[Test-AI] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
