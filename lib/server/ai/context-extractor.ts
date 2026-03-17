/**
 * Context Extractor — fire & forget background agent
 * Mengekstrak fakta pelanggan dari setiap exchange user+AI menggunakan Gemini Flash Lite
 * Diport dari src/ai/agents/contextExtractor.js
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { getDb } from '@/lib/server/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Model ringan — cepat dan murah
const EXTRACTOR_MODEL = 'gemini-3.1-flash-lite-preview';

const EXTRACTOR_PROMPT = `Kamu adalah data extractor untuk sistem CRM bengkel motor.
Tugasmu ada dua:
1. Mengekstrak fakta dari percakapan, termasuk harga yang dikutip oleh AI ke pelanggan.
2. Membuat/memperbarui ringkasan obrolan (conversation_summary).

Kembalikan JSON saja. Tidak ada teks lain. Tidak ada markdown.

Waktu Sekarang: {timestamp}
Ringkasan Obrolan Sebelumnya:
{currentSummary}

Percakapan Saat Ini:
User: "{userMessage}"
AI: "{aiReply}"

Ekstrak ke format ini (isi null jika tidak disebutkan):
{
  "motor_model": null,
  "motor_year": null,
  "motor_color": null,
  "motor_condition": null,
  "target_service": null,
  "service_detail": null,
  "budget_signal": null,
  "intent_level": null,
  "said_expensive": null,
  "asked_price": null,
  "asked_availability": null,
  "shared_photo": null,
  "preferred_day": null,
  "location_hint": null,
  "quoted_services": [],
  "quoted_total_normal": null,
  "quoted_total_bundling": null,
  "quoted_at": null,
  "conversation_stage": null,
  "last_ai_action": null,
  "upsell_offered": null,
  "upsell_accepted": null,
  "conversation_summary": "Ringkasan SINGKAT dan PADAT tentang apa yang diobrolkan sejauh ini, gabungan dari ringkasan sebelumnya dan percakapan saat ini."
}

Aturan ketat:
- Hanya isi field fakta yang BENAR-BENAR ada di percakapan ini
- Jangan inferensi atau mengarang fakta
- conversation_stage: 
    "greeting"     → baru mulai
    "qualifying"   → AI sedang tanya motor/kebutuhan
    "consulting"   → AI sudah kasih info layanan/harga
    "upselling"    → AI sedang tawarkan layanan tambahan
    "booking"      → sedang proses jadwal
    "closing"      → user sudah setuju, tinggal konfirmasi
    "done"         → booking terkonfirmasi
- last_ai_action: apa yang terakhir dilakukan AI ("asked_motor_type", "quoted_price", "offered_upsell", "offered_booking", etc)
- upsell_offered: true jika AI sudah tawarkan upsell di conversation ini
- upsell_accepted: true/false/null
- quoted_services: Hanya isi jika AI memberikan penawaran harga spesifik di "AI: {aiReply}". Format: [{"name": "Nama Layanan", "price": 1200000}]
- quoted_total_normal: Total harga sebelum diskon.
- quoted_total_bundling: Harga paket/bundling jika ditawarkan oleh AI.
- quoted_at: Isi dengan "{timestamp}" jika ada quoted_services yang baru diberikan.
- intent_level: "hot" jika tanya jadwal/mau datang, 
               "warm" jika tanya harga/detail,
               "cold" jika hanya lihat-lihat
- budget_signal: "ketat" jika bilang mahal/kemahalan,
               "oke" jika setuju harga,
               null jika tidak disebut
- conversation_summary: WAJIB diisi. Gabungkan intisari "Ringkasan Obrolan Sebelumnya" (jika ada) dengan "Percakapan Saat Ini" menjadi 1-2 kalimat padat. Fokus pada apa yang diinginkan/ditanyakan customer.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrompt(
  userMessage: string,
  aiReply: string,
  currentSummary: string = '',
  timestamp: string = ''
): string {
  const ts = timestamp || new Date().toISOString();
  return EXTRACTOR_PROMPT
    .replace('{timestamp}', ts)
    .replace(/\{timestamp\}/g, ts)
    .replace('{currentSummary}', currentSummary || '(Belum ada ringkasan)')
    .replace('{userMessage}', (userMessage || '').replace(/"/g, '\\"'))
    .replace('{aiReply}', (aiReply || '').replace(/"/g, '\\"'));
}

function parseExtractedJSON(text: string): Record<string, unknown> | null {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch (error: any) {
    console.warn('[ContextExtractor] Failed to parse JSON:', error.message);
    return null;
  }
}

/**
 * Merge extracted data dengan data yang sudah ada di Firestore.
 * - Null/undefined di newData → pertahankan data lama
 * - upsell_offered: sticky true (tidak bisa balik false)
 */
function mergeContextData(
  current: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(newData)) {
    if (value === null || value === undefined || value === '') {
      merged[key] = current[key] ?? null;
    } else if (key === 'upsell_offered' && current[key] === true) {
      merged[key] = true; // Sticky: tidak bisa reset ke false
    } else {
      merged[key] = value;
    }
  }

  // Pertahankan fields lama yang tidak ada di newData
  for (const [key, value] of Object.entries(current)) {
    if (!(key in merged)) {
      merged[key] = value;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Extract context dari 1 exchange user+AI dan simpan ke Firestore.
 * Dirancang untuk dipanggil fire-and-forget (tidak diawait di main flow).
 */
export async function extractAndSaveContext(
  userMessage: string,
  aiReply: string,
  senderNumber: string
): Promise<void> {
  if (!userMessage || !senderNumber) return;
  // Skip untuk nomor testing yang tidak valid
  if (senderNumber === 'unknown') return;

  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[ContextExtractor] No API key — skipping extraction');
      return;
    }

    const db = getDb();
    const docId = senderNumber.replace(/\D/g, '') || senderNumber;
    if (!docId) return;

    // Ambil existing context untuk current summary
    let currentSummary = '';
    try {
      const ctxDoc = await db.collection('customerContext').doc(docId).get();
      if (ctxDoc.exists) {
        currentSummary = (ctxDoc.data()?.conversation_summary as string) || '';
      }
    } catch {
      // Ignore — bisa lanjut tanpa previous summary
    }

    const timestamp = new Date().toISOString();
    const prompt = buildPrompt(userMessage, aiReply, currentSummary, timestamp);

    const model = new ChatGoogleGenerativeAI({
      model: EXTRACTOR_MODEL,
      temperature: 0,
      apiKey,
    });

    const response = await model.invoke(
      [new HumanMessage(prompt)],
      {
        runName: 'ContextExtractor',
        tags: ['background-task', 'extractor'],
        metadata: { senderNumber }
      }
    );

    const responseText =
      typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
        ? response.content.map((c: any) => c.text || c).join('')
        : String(response.content);

    const extracted = parseExtractedJSON(responseText);
    if (!extracted) {
      console.warn('[ContextExtractor] Invalid JSON response, skipping');
      return;
    }

    // Merge dengan data existing
    const ctxRef = db.collection('customerContext').doc(docId);
    const existingDoc = await ctxRef.get();
    const current = existingDoc.exists
      ? { ...(existingDoc.data() || {}), updatedAt: undefined, senderNumber: undefined }
      : {};

    const merged = mergeContextData(current as Record<string, unknown>, extracted);

    await ctxRef.set(
      {
        ...merged,
        updatedAt: FieldValue.serverTimestamp(),
        senderNumber,
      },
      { merge: true }
    );

    console.log(
      `[ContextExtractor] Saved for ${docId}:`,
      Object.keys(merged)
        .filter((k) => merged[k] !== null)
        .join(', ')
    );
  } catch (error: any) {
    console.warn('[ContextExtractor] Extraction failed:', error.message);
    // Fire-and-forget: jangan re-throw
  }
}
