/**
 * Customer Context Builder
 * Diport dari app.js: persistent memory injection + dynamic flow directive
 */

import { getDb } from '@/lib/server/firebase-admin';

export interface CustomerContext {
  conversation_summary?: string;
  motor_model?: string;
  motor_year?: string;
  motor_color?: string;
  motor_condition?: string;
  target_service?: string;
  service_detail?: string;
  budget_signal?: string;
  intent_level?: string;
  said_expensive?: boolean;
  asked_price?: boolean;
  asked_availability?: boolean;
  shared_photo?: boolean;
  preferred_day?: string;
  location_hint?: string;
  quoted_services?: Array<{ name: string; price?: number }>;
  quoted_total_bundling?: number;
  quoted_at?: string;
  conversation_stage?: string;
  last_ai_action?: string;
  upsell_offered?: boolean;
}

export interface ConversationState {
  motor_model?: string;
  target_service?: string;
  important_notes?: string;
}

/**
 * Ambil customer context dari Firestore (background extractor output)
 */
export async function getCustomerContext(
  senderNumber: string
): Promise<CustomerContext | null> {
  const db = getDb();
  if (!db) return null;

  const docId = senderNumber.replace(/\D/g, '') || senderNumber;
  if (!docId) return null;

  try {
    const doc = await db.collection('customerContext').doc(docId).get();
    if (doc.exists) return doc.data() as CustomerContext;
    return null;
  } catch (error: any) {
    console.warn('[Context] getCustomerContext error:', error.message);
    return null;
  }
}

/**
 * Ambil conversation state legacy dari Firestore
 */
export async function getConversationState(
  senderNumber: string
): Promise<ConversationState | null> {
  const db = getDb();
  if (!db) return null;

  const docId = senderNumber.replace(/\D/g, '') || senderNumber;
  if (!docId) return null;

  try {
    const doc = await db.collection('conversationState').doc(docId).get();
    if (doc.exists) return doc.data() as ConversationState;
    return null;
  } catch (error: any) {
    console.warn('[Context] getConversationState error:', error.message);
    return null;
  }
}

/**
 * Build memoryPart string untuk di-inject ke system prompt
 * Port dari app.js baris 1030–1135 (identik)
 */
export function buildMemoryPart(
  customerCtx: CustomerContext | null,
  state: ConversationState | null
): string {
  const parts: string[] = [];

  if (customerCtx) {
    if (customerCtx.conversation_summary) {
      parts.push('[RINGKASAN OBROLAN SEBELUMNYA]');
      parts.push(customerCtx.conversation_summary);
      parts.push('---------------------------');
    }

    if (customerCtx.motor_model) parts.push(`- Motor: ${customerCtx.motor_model}`);
    if (customerCtx.motor_year) parts.push(`- Tahun motor: ${customerCtx.motor_year}`);
    if (customerCtx.motor_color) parts.push(`- Warna motor: ${customerCtx.motor_color}`);
    if (customerCtx.motor_condition) parts.push(`- Kondisi: ${customerCtx.motor_condition}`);
    if (customerCtx.target_service) parts.push(`- Layanan diminati: ${customerCtx.target_service}`);
    if (customerCtx.service_detail) parts.push(`- Detail layanan: ${customerCtx.service_detail}`);
    if (customerCtx.budget_signal) parts.push(`- Sinyal budget: ${customerCtx.budget_signal}`);
    if (customerCtx.intent_level) parts.push(`- Level intent: ${customerCtx.intent_level}`);
    if (customerCtx.said_expensive === true) parts.push('- ⚠️ Pernah bilang mahal');
    if (customerCtx.asked_price === true) parts.push('- Sudah tanya harga');
    if (customerCtx.asked_availability === true) parts.push('- Sudah tanya jadwal');
    if (customerCtx.shared_photo === true) parts.push('- Sudah kirim foto motor');
    if (customerCtx.preferred_day) parts.push(`- Preferensi hari: ${customerCtx.preferred_day}`);
    if (customerCtx.location_hint) parts.push(`- Lokasi: ${customerCtx.location_hint}`);

    if (customerCtx.quoted_services && customerCtx.quoted_services.length > 0) {
      const serviceList = customerCtx.quoted_services
        .map((s) => `${s.name}: Rp${s.price?.toLocaleString('id-ID') || '?'}`)
        .join(', ');
      parts.push(`- Harga sudah dikutip: ${serviceList}`);
    }

    if (customerCtx.quoted_total_bundling) {
      parts.push(
        `- Total bundling (diskon): Rp${customerCtx.quoted_total_bundling.toLocaleString('id-ID')}`
      );
    }
    if (customerCtx.quoted_at) parts.push(`- Penawaran terakhir: ${customerCtx.quoted_at}`);
    if (customerCtx.conversation_stage)
      parts.push(`- Stage percakapan: ${customerCtx.conversation_stage}`);
    if (customerCtx.last_ai_action)
      parts.push(`- Aksi AI terakhir: ${customerCtx.last_ai_action}`);
    if (customerCtx.upsell_offered === true)
      parts.push('- ⚠️ Upsell sudah ditawarkan, JANGAN tawarkan lagi');

    // Dynamic Flow Directive
    const mModel = customerCtx.motor_model || state?.motor_model;
    const tService = customerCtx.target_service || state?.target_service;
    const mCond = customerCtx.motor_condition;
    const mColor = customerCtx.motor_color;
    const isRepaint = tService?.toLowerCase().includes('repaint');
    const isRepaintVelg = tService?.toLowerCase().includes('velg');
    const isDetailing =
      tService?.toLowerCase().includes('detailing') ||
      tService?.toLowerCase().includes('cuci');

    let actionDirective = '';

    if (!mModel) {
      actionDirective = `\n🎯 TARGET SAAT INI (KUALIFIKASI): Kamu belum tahu *jenis/tipe motor* user. Tanyakan tipe motornya secara natural. JANGAN bahas harga atau jadwal dulu.`;
    } else if (!tService) {
      actionDirective = `\n🎯 TARGET SAAT INI (KUALIFIKASI): Kamu sudah tahu motornya (${mModel}), tapi belum tahu *layanan yang dibutuhkan* (Repaint/Detailing/Coating). Tanyakan kebutuhannya apa.`;
    } else if (isRepaint && !mColor) {
      actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI WARNA): User butuh Repaint untuk ${mModel}. Tanyakan *warna yang diinginkan* (Standar/Candy/Stabilo/Bunglon/Chrome) karena ada biaya tambahan (surcharge) untuk warna spesial.`;
    } else if (isRepaint && !mCond) {
      actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI BODI): User butuh Repaint. Tanyakan *kondisi bodi saat ini* (apakah ada lecet parah, pecah, atau butuh repair bodi kasar) karena bisa ada biaya tambahan perbaikan.`;
    } else if (
      isRepaintVelg &&
      !customerCtx.upsell_offered &&
      !customerCtx.quoted_services?.length
    ) {
      actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI VELG): User butuh Repaint Velg. Tanyakan apakah velg *pernah dicat ulang* atau *banyak jamur/kerak*, karena ada biaya tambahan remover (+50rb s/d 100rb). Boleh juga tawarkan sekalian cat Behel/Arm (+50rb) atau CVT (+100rb).`;
    } else if (isDetailing && !mCond) {
      actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI MOTOR): User butuh Detailing/Cuci untuk ${mModel}. Tanyakan dulu *kondisi motornya saat ini* (apakah banyak kerak oli, jamur, kusam, atau sekadar kotor debu) supaya kamu bisa merekomendasikan paket Detailing yang paling pas.`;
    } else if (!customerCtx.quoted_services || customerCtx.quoted_services.length === 0) {
      actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI HARGA): Informasi sudah cukup (${mModel}, ${tService}, Warna/Kondisi sudah dikonfirmasi). SEGERA panggil tool \`getServiceDetails\` untuk mengecek harga (termasuk surcharge jika ada) dan jelaskan ke user secara singkat.`;
    } else if (!customerCtx.upsell_offered && customerCtx.intent_level !== 'hot') {
      actionDirective = `\n🎯 TARGET SAAT INI (EDUKASI & UPSELL): Kamu sudah mengutip harga. Jelaskan kelebihan layanan ini dengan santai, lalu tawarkan *upsell ringan 1x* (misal: "sekalian cuci komplit rangka mumpung dibongkar mas?").`;
    } else if (!customerCtx.preferred_day && !customerCtx.asked_availability) {
      actionDirective = `\n🎯 TARGET SAAT INI (CLOSING): User sudah tahu harga dan layanannya. Giring perlahan untuk booking dengan bertanya "Rencana mau dikerjakan hari apa Mas?" atau "Mau Zoya cek jadwal kosongnya?".`;
    } else if (customerCtx.conversation_stage === 'closing') {
      actionDirective = `\n🎯 TARGET SAAT INI (CLOSING FINAL): User sudah setuju. LANGSUNG panggil \`checkBookingAvailability\` dan buat bookingnya. STOP tanya hal lain.`;
    }

    if (actionDirective) parts.push(actionDirective);
  }

  // Fallback: Legacy state
  if (state) {
    if (state.motor_model && !customerCtx?.motor_model)
      parts.push(`- Motor: ${state.motor_model}`);
    if (state.target_service && !customerCtx?.target_service)
      parts.push(`- Layanan dituju: ${state.target_service}`);
    if (state.important_notes) parts.push(`- Catatan: ${state.important_notes}`);
  }

  if (parts.length === 0) return '';

  return `\n\n[PERSISTENT CONTEXT]\nInformasi yang sudah diketahui tentang pelanggan ini:\n${parts.join('\n')}\n(Gunakan informasi ini jika relevan, jangan tanya ulang hal yang sudah diketahui).`;
}

/**
 * Fetch dan build promo inject string dari Firestore
 */
export async function getPromoInject(): Promise<string> {
  const db = getDb();
  if (!db) return '';

  try {
    const promoDoc = await db.collection('settings').doc('promo_config').get();
    if (promoDoc.exists && promoDoc.data()?.isActive) {
      const promoText = promoDoc.data()?.promoText;
      if (promoText) {
        return `\n\n[PROMO AKTIF SAAT INI]\n${promoText}\n(Gunakan layanan promo ini sebagai penawaran diskon/upsell jika cocok dengan kebutuhan pelanggan, cukup gunakan informasi seperlunya tanpa mengorbankan token).`;
      }
    }
  } catch (error: any) {
    console.warn('[Context] getPromoInject error:', error.message);
  }
  return '';
}
