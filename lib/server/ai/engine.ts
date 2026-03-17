/**
 * AI Engine — getAIResponse()
 * Jantung sistem: LangChain + Gemini agentic loop
 * Port dari app.js getAIResponse() + analyzeMediaWithGemini()
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { DateTime } from 'luxon';

import { CUSTOMER_SYSTEM_PROMPT, ADMIN_SYSTEM_PROMPT } from './system-prompts';
import {
  getConversationHistory,
  buildLangChainHistory,
  isShortOrAmbiguous,
} from './memory';
import {
  getCustomerContext,
  getConversationState,
  buildMemoryPart,
  getPromoInject,
} from './context';
import {
  getAllTools,
  getCustomerTools,
  prepareToolSpecs,
  buildAvailableTools,
  type Tool,
} from './tools/index';
import { getDb } from '@/lib/server/firebase-admin';

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------

const API_KEYS = [
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_API_KEY_FALLBACK,
].filter(Boolean) as string[];

if (API_KEYS.length === 0 && process.env.NODE_ENV !== 'test') {
  console.warn('[Engine] ⚠️ GOOGLE_API_KEY is not set');
}

const ACTIVE_AI_MODEL = process.env.AI_MODEL || 'gemini-2.5-flash';
const ACTIVE_AI_TEMPERATURE = (() => {
  const raw = process.env.AI_TEMPERATURE;
  if (!raw) return 0.7;
  const parsed = parseFloat(raw.replace(/['"]/g, ''));
  return isNaN(parsed) ? 0.7 : parsed;
})();

// Admin numbers
const ADMIN_NUMBERS = [
  process.env.BOSMAT_ADMIN_NUMBER,
  process.env.ADMIN_WHATSAPP_NUMBER,
].filter(Boolean) as string[];

function isAdminNumber(senderNumber: string): boolean {
  const normalize = (n: string) => n.replace(/\D/g, '');
  const senderNorm = normalize(senderNumber);
  return ADMIN_NUMBERS.some((n) => normalize(n) === senderNorm);
}

// ---------------------------------------------------------------------------
// Dynamic system prompt loader from Firestore
// ---------------------------------------------------------------------------
let cachedSystemPrompt: string | null = null;

async function loadSystemPromptFromFirestore(): Promise<string> {
  const db = getDb();
  if (!db) return CUSTOMER_SYSTEM_PROMPT;

  try {
    const doc = await db.collection('settings').doc('ai_config').get();
    if (doc.exists && doc.data()?.systemPrompt) {
      return doc.data()!.systemPrompt as string;
    }
  } catch (error: any) {
    console.warn('[Engine] Failed to load system prompt from Firestore:', error.message);
  }
  return CUSTOMER_SYSTEM_PROMPT;
}

// ---------------------------------------------------------------------------
// Tool execution helper
// ---------------------------------------------------------------------------
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  availableTools: Record<string, (a: Record<string, unknown>) => Promise<unknown>>,
  metadata: { senderNumber?: string; senderName?: string }
): Promise<unknown> {
  console.log(`\n⚡[TOOL_CALL] ${toolName}`, JSON.stringify(args, null, 2));

  const impl = availableTools[toolName];
  if (!impl) {
    console.error(`❌[TOOL_CALL] Tool ${toolName} not found`);
    return { error: `Tool ${toolName} tidak tersedia` };
  }

  // Force-inject metadata so model cannot hallucinate sender identity
  const preparedArgs = { ...args };
  if (metadata.senderNumber) {
    preparedArgs.senderNumber = metadata.senderNumber;
    preparedArgs.sender_number = metadata.senderNumber;
  }
  if (metadata.senderName) {
    preparedArgs.senderName = metadata.senderName;
    preparedArgs.sender_name = metadata.senderName;
  }

  try {
    const startTime = Date.now();
    const result = await impl(preparedArgs);
    console.log(`✅[TOOL_CALL] ${toolName} (${Date.now() - startTime}ms)`, JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error(`❌[TOOL_CALL] ${toolName} failed:`, error.message);
    return { error: `Kesalahan saat menjalankan ${toolName}: ${error.message}` };
  }
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as Array<{ text?: string; message?: string }>)
      .map((p) => p?.text || p?.message || '')
      .filter(Boolean)
      .join('\n');
  }
  if (content && typeof content === 'object' && 'text' in content) {
    return (content as { text: string }).text;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Dynamic Intent Router — route tools customer berdasarkan context + message
// Diport dari app.js routeCustomerTools()
// ---------------------------------------------------------------------------
function routeCustomerTools(
  ctx: Record<string, unknown> | null,
  humanMsg: string | Array<Record<string, unknown>>
): Tool[] {
  const msgText: string = Array.isArray(humanMsg)
    ? ((humanMsg.find((p) => p.type === 'text') as any)?.text || '')
    : (typeof humanMsg === 'string' ? humanMsg : '');
  const msgLower = msgText.toLowerCase();
  const intent = (ctx?.intent_level as string) || 'null';

  const allCustomer = getCustomerTools();
  const byName = (name: string) => allCustomer.find(
    (t) => t.toolDefinition?.function?.name === name
  );
  const routed: Tool[] = [];
  const add = (name: string) => { const t = byName(name); if (t && !routed.includes(t)) routed.push(t); };

  // 1. Always: notifyVisitIntent + triggerBosMatTool
  add('notifyVisitIntent');
  add('triggerBosMatTool');

  // 2. Studio info — hanya kalau tanya lokasi/jam
  if (
    msgLower.includes('alamat') || msgLower.includes('lokasi') ||
    msgLower.includes('dimana') || msgLower.includes('jam') ||
    msgLower.includes('buka') || msgLower.includes('tutup') || msgLower.includes('maps')
  ) { add('getStudioInfo'); }

  // 3. Service & pricing — cold/null intent ATAU nanya harga
  if (
    !ctx || intent === 'cold' || intent === 'null' ||
    msgLower.includes('harga') || msgLower.includes('biaya') || msgLower.includes('berapa') ||
    msgLower.includes('layanan') || msgLower.includes('repaint') ||
    msgLower.includes('coating') || msgLower.includes('detailing')
  ) { add('getServiceDetails'); }

  // 4. Booking — warm/hot intent ATAU nanya jadwal
  if (
    intent === 'warm' || intent === 'hot' ||
    msgLower.includes('booking') || msgLower.includes('jadwal') ||
    msgLower.includes('kapan') || msgLower.includes('kosong') ||
    msgLower.includes('besok') || msgLower.includes('hari ini')
  ) {
    add('checkBookingAvailability');
    add('createBooking');
    add('updateBooking');
  }

  // 5. Home service
  if (
    ctx?.location_hint ||
    msgLower.includes('home service') || msgLower.includes('rumah') || msgLower.includes('jemput')
  ) { add('calculateHomeServiceFee'); }

  // 6. Studio foto
  if (msgLower.includes('foto') || msgLower.includes('lihat') || msgLower.includes('gambar')) {
    add('sendStudioPhoto');
  }

  console.log(
    `\u{1F527} [ENGINE] Dynamic tools routed (CUSTOMER, ${routed.length}): ${
      routed.map((t) => t.toolDefinition?.function?.name).join(', ')
    }`
  );

  // Fallback: kalau terlalu sedikit, pakai full customer set
  return routed.length > 1 ? routed : allCustomer;
}

// ---------------------------------------------------------------------------
// getAIResponse — main entrypoint
// ---------------------------------------------------------------------------
export interface AIEngineInput {
  message: string;
  senderNumber?: string;
  senderName?: string;
  /** Override: force admin/customer mode regardless of phone number */
  isAdminOverride?: boolean;
  /** Fonnte media URL — will be downloaded + analyzed inline by same model */
  mediaUrl?: string;
  mediaExtension?: string;
  /** Provide conversation history externally (e.g. playground) */
  providedHistory?: Array<{ role: 'human' | 'ai'; content: string }>;
}

export interface AIEngineResult {
  response: string;
  isAdmin: boolean;
  toolsCalled: string[];
}

export async function getAIResponse(input: AIEngineInput): Promise<AIEngineResult> {
  const {
    message,
    senderNumber = 'unknown',
    senderName = 'User',
    isAdminOverride,
    mediaUrl,
    mediaExtension,
    providedHistory,
  } = input;

  console.log('\n🤖 [ENGINE] ===== STARTING AI PROCESSING =====');
  console.log(`📝 Message: "${message}"`);
  console.log(`👤 Sender: ${senderName} (${senderNumber})`);

  // 1. Determine mode
  const isAdmin =
    isAdminOverride !== undefined
      ? isAdminOverride
      : isAdminNumber(senderNumber);

  // 2. Load system prompt
  const baseSystemPrompt = isAdmin
    ? ADMIN_SYSTEM_PROMPT
    : await loadSystemPromptFromFirestore();

  // 3. DateTime inject (hemat 1 tool call)
  const now = DateTime.now().setZone('Asia/Jakarta').setLocale('id');
  const dateTimePart = `\nSekarang: ${now.toFormat('cccc, d LLLL yyyy HH:mm')} WIB.`;

  // 4. Memory / context inject (customer only)
  let customerCtx: Record<string, unknown> | null = null;
  let memoryPart = '';
  if (!isAdmin && senderNumber !== 'unknown') {
    const [fetchedCtx, state] = await Promise.all([
      getCustomerContext(senderNumber),
      getConversationState(senderNumber),
    ]);
    customerCtx = fetchedCtx as unknown as Record<string, unknown>;
    memoryPart = buildMemoryPart(fetchedCtx, state);
  }

  // 5. Promo inject
  const promoInject = await getPromoInject();

  const effectiveSystemPrompt =
    baseSystemPrompt + dateTimePart + memoryPart + promoInject;

  // 6. Conversation history (conditional — hemat token)
  let historyMessages: (HumanMessage | AIMessage)[] = [];

  if (providedHistory && providedHistory.length > 0) {
    historyMessages = providedHistory.map((h) =>
      h.role === 'human' ? new HumanMessage(h.content) : new AIMessage(h.content)
    );
  } else if (senderNumber !== 'unknown' && isShortOrAmbiguous(message)) {
    console.log('[Engine] Short message detected — loading history');
    const history = await getConversationHistory(senderNumber, 4);
    historyMessages = buildLangChainHistory(history);
  }

  // 7. Build user message content (text + optional media)
  let humanMessageContent: string | Array<Record<string, unknown>>;

  if (mediaUrl) {
    try {
      console.log('[Engine] Downloading media:', mediaUrl);
      const { downloadAttachment } = await import('@/lib/server/fonnte-client');
      const { buffer } = await downloadAttachment(mediaUrl);
      const base64Data = buffer.toString('base64');

      // Determine MIME type
      const ext = (mediaExtension || '').toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'mp4') mimeType = 'video/mp4';
      else if (ext === 'avi') mimeType = 'video/avi';
      else if (ext === 'mov') mimeType = 'video/quicktime';

      const isVideo = mimeType.startsWith('video/');

      // Vision analysis prompt injected into message
      const visionPrompt = message
        ? message
        : `Analisis media motor dari ${senderName}. Sebutkan kondisi yang terlihat dan rekomendasikan treatment Bosmat yang relevan.`;

      if (isVideo) {
        humanMessageContent = [
          { type: 'text', text: visionPrompt },
          { type: 'media', mimeType, data: base64Data },
        ];
      } else {
        humanMessageContent = [
          { type: 'text', text: visionPrompt },
          { type: 'image_url', image_url: `data:${mimeType};base64,${base64Data}` },
        ];
      }
    } catch (mediaError: any) {
      console.warn('[Engine] Media download failed:', mediaError.message);
      humanMessageContent = message || '(Media diterima tapi gagal dianalisis)';
    }
  } else {
    humanMessageContent = message;
  }

  // 8. Setup tools — Dynamic Intent Router untuk customer (hemat token)
  let tools: Tool[];
  if (isAdmin) {
    tools = getAllTools();
  } else {
    tools = routeCustomerTools(customerCtx, humanMessageContent);
  }
  const toolSpecs = prepareToolSpecs(tools);

  // Build available tools map with overrides for dynamic system prompt
  const availableTools = buildAvailableTools(tools, {
    // Override updateSystemPrompt to also update in-memory cache
    updateSystemPrompt: async (args) => {
      const impl = getAllTools().find(
        (t) => t.toolDefinition?.function?.name === 'updateSystemPrompt'
      )?.implementation;
      if (!impl) return { error: 'Tool not found' };
      const result = await impl(args);
      if ((result as any)?.status === 'success' && args.newPrompt) {
        cachedSystemPrompt = args.newPrompt as string;
        console.log('[Engine] In-memory System Prompt updated via tool.');
      }
      return result;
    },
    // Override getSystemPrompt to return active prompt
    getSystemPrompt: async (args) => {
      const impl = getAllTools().find(
        (t) => t.toolDefinition?.function?.name === 'getSystemPrompt'
      )?.implementation;
      if (!impl) return { error: 'Tool not found' };
      return impl({ ...args, activePrompt: cachedSystemPrompt ?? baseSystemPrompt });
    },
  });

  // 9. Initialize model with tools
  const model = new ChatGoogleGenerativeAI({
    model: ACTIVE_AI_MODEL,
    temperature: ACTIVE_AI_TEMPERATURE,
    apiKey: API_KEYS[0],
  });

  const modelWithTools = model.bindTools(toolSpecs);

  // 10. Build messages array
  const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
    new SystemMessage(effectiveSystemPrompt),
    ...historyMessages,
    new HumanMessage(humanMessageContent as string),
  ];

  // 11. Agentic loop
  const metadata = { senderNumber, senderName };
  const toolsCalled: string[] = [];
  const MAX_ITERATIONS = 10;
  let finalResponse = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n🔄 [ENGINE] Iteration ${i + 1}`);

    let aiResponse;
    try {
      aiResponse = await modelWithTools.invoke(messages);
    } catch (error: any) {
      // Fallback to secondary API key if quota error
      if (
        API_KEYS.length > 1 &&
        (error?.message?.includes('quota') ||
          error?.message?.includes('429') ||
          error?.message?.includes('RESOURCE_EXHAUSTED'))
      ) {
        console.warn('[Engine] Primary key quota hit, trying fallback key...');
        const fallbackModel = new ChatGoogleGenerativeAI({
          model: ACTIVE_AI_MODEL,
          temperature: ACTIVE_AI_TEMPERATURE,
          apiKey: API_KEYS[1],
        }).bindTools(toolSpecs);
        aiResponse = await fallbackModel.invoke(messages);
      } else {
        throw error;
      }
    }

    // Get tool calls
    const toolCalls =
      aiResponse.tool_calls ||
      (aiResponse.additional_kwargs?.tool_calls as typeof aiResponse.tool_calls) ||
      [];

    // If no tool calls → final answer
    if (!toolCalls || toolCalls.length === 0) {
      finalResponse = extractText(aiResponse.content);
      break;
    }

    // Execute tool calls
    messages.push(aiResponse as AIMessage);

    for (const tc of toolCalls) {
      const toolName = tc.name;
      const toolArgs = (tc.args || {}) as Record<string, unknown>;

      toolsCalled.push(toolName);
      const result = await executeToolCall(toolName, toolArgs, availableTools, metadata);

      messages.push(
        new ToolMessage({
          content: JSON.stringify(result),
          tool_call_id: tc.id || toolName,
        })
      );
    }
  }

  if (!finalResponse) {
    finalResponse = 'Maaf, ada kendala teknis saat memproses. Mohon coba lagi ya.';
  }

  console.log(`\n✅ [ENGINE] Final response: "${finalResponse.substring(0, 100)}..."`);
  console.log(`🔧 [ENGINE] Tools called: ${toolsCalled.join(', ') || 'none'}`);

  return { response: finalResponse, isAdmin, toolsCalled };
}
