/**
 * Customer Classifier — rule-based, 0 token cost
 * Classifikasi customer → hot_lead/warm_lead/loyal/dll
 * Diport dari src/ai/agents/customerClassifier.js
 */

import { getDb } from '@/lib/server/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Follow-Up Strategy Map ──────────────────────────────────────────────────

const STRATEGY_MAP: Record<string, string> = {
  window_shopper: 'minimal',
  warm_lead: 'nurture',
  hot_lead: 'aggressive',
  existing: 'retention',
  loyal: 'vip',
  churned: 'winback',
  dormant_lead: 'stop',
};

// Label mapping: classifier → dashboard (directMessages)
const LABEL_MAPPING: Record<string, string> = {
  hot_lead: 'hot_lead',
  warm_lead: 'general',
  lead: 'general',
  window_shopper: 'cold_lead',
  existing: 'completed',
  existing_customer: 'completed',
  loyal: 'completed',
  churned: 'archive',
  dormant_lead: 'archive',
};

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

function daysSince(date: Date | null): number {
  if (!date) return 999;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

// ─── Ghost Tracking ──────────────────────────────────────────────────────────

async function updateGhostedCount(
  docId: string,
  context: Record<string, unknown>,
  metadata: Record<string, unknown>
): Promise<number> {
  const lastSender = metadata.lastMessageSender as string | undefined;
  const lastChat = parseDateField(metadata.lastMessageAt);
  const daysSinceLastChat = daysSince(lastChat);

  const isCurrentlyGhosted = lastSender === 'ai' && daysSinceLastChat > 2;
  if (!isCurrentlyGhosted) return (context.ghosted_times as number) || 0;

  // Cegah double-increment dalam 48 jam
  const alreadyCounted = context.last_ghost_counted_at as string | undefined;
  if (alreadyCounted) {
    const hoursSince = (Date.now() - new Date(alreadyCounted).getTime()) / 3600000;
    if (hoursSince < 48) return (context.ghosted_times as number) || 0;
  }

  const newCount = ((context.ghosted_times as number) || 0) + 1;
  const db = getDb();
  await db.collection('customerContext').doc(docId).update({
    ghosted_times: newCount,
    last_ghost_counted_at: new Date().toISOString(),
  });

  return newCount;
}

// ─── Transaction Lookup ───────────────────────────────────────────────────────

async function getCustomerTransactions(
  docId: string,
  customerName?: string | null
): Promise<Array<Record<string, unknown>>> {
  const db = getDb();

  // Strategy 1: match by customerNumber (normalized)
  for (const num of [docId, `${docId}@c.us`, docId.startsWith('62') ? '0' + docId.substring(2) : null]) {
    if (!num) continue;
    const snap = await db
      .collection('transactions')
      .where('customerNumber', '==', num)
      .orderBy('date', 'desc')
      .limit(50)
      .get();
    if (!snap.empty) return snap.docs.map((d) => d.data() as Record<string, unknown>);
  }

  // Strategy 2: fuzzy match by name
  if (customerName && customerName.length > 2) {
    const allSnap = await db
      .collection('transactions')
      .where('customerName', '!=', null)
      .limit(200)
      .get();
    const nameLower = customerName.toLowerCase();
    const matched = allSnap.docs
      .filter((d) => {
        const txName = ((d.data().customerName as string) || '').toLowerCase();
        return txName === nameLower || txName.includes(nameLower) || nameLower.includes(txName);
      })
      .map((d) => d.data() as Record<string, unknown>);
    if (matched.length > 0) return matched;
  }

  return [];
}

// ─── Scoring Engine ──────────────────────────────────────────────────────────

interface ScoreResult {
  label: string;
  confidence: number;
  scores: Record<string, number>;
  reason: string;
  txCount: number;
  daysSinceLastChat: number;
  daysSinceLastTx: number;
}

function scoreCustomer(
  context: Record<string, unknown>,
  metadata: Record<string, unknown>,
  transactions: Array<Record<string, unknown>>
): ScoreResult {
  const scores: Record<string, number> = {
    window_shopper: 0,
    warm_lead: 0,
    hot_lead: 0,
    existing: 0,
    loyal: 0,
    churned: 0,
    dormant_lead: 0,
  };

  const lastChat = parseDateField(metadata.lastMessageAt);
  const daysSinceLastChat = daysSince(lastChat);
  const completedTx = transactions.filter((t) => t.type === 'income');
  const txCount = completedTx.length;

  let daysSinceLastTx = 999;
  if (completedTx.length > 0) {
    const lastTxDate = parseDateField(completedTx[0].date);
    daysSinceLastTx = daysSince(lastTxDate);
  }

  const ghosted = metadata.lastMessageSender === 'ai' && daysSinceLastChat > 2;
  const ghostedTimes = (context.ghosted_times as number) || (ghosted ? 1 : 0);

  // ── Transaction-based (prioritas tertinggi) ──
  if (txCount >= 2) {
    if (daysSinceLastTx > 90) scores.churned += 100;
    else scores.loyal += 100;
  } else if (txCount === 1) {
    if (daysSinceLastTx > 90) scores.churned += 80;
    else scores.existing += 100;
  }

  // ── Lead scoring (hanya kalau 0 transaksi) ──
  if (txCount === 0) {
    if (ghostedTimes >= 2) scores.dormant_lead += 100;

    if (context.asked_availability) scores.hot_lead += 50;
    if (context.shared_photo) scores.hot_lead += 30;
    if (context.intent_level === 'hot') scores.hot_lead += 20;

    if (context.asked_price && !context.said_expensive) scores.warm_lead += 50;
    if (context.intent_level === 'warm') scores.warm_lead += 30;
    if (daysSinceLastChat <= 3) scores.warm_lead += 20;

    if (context.said_expensive) scores.window_shopper += 60;
    if (context.budget_signal === 'ketat') scores.window_shopper += 30;
    if (ghosted && ghostedTimes === 1) scores.window_shopper += 40;
  }

  // ── Label Reset Conditions ──
  if (context.customer_label === 'hot_lead' && daysSinceLastChat > 7 && txCount === 0) {
    scores.hot_lead = 0;
    scores.warm_lead = Math.max(scores.warm_lead, 50);
  }
  if (context.customer_label === 'warm_lead' && ghostedTimes >= 1 && daysSinceLastChat > 14) {
    scores.warm_lead = 0;
    scores.window_shopper = Math.max(scores.window_shopper, 50);
  }
  if (context.customer_label === 'existing' && daysSinceLastTx > 90) {
    scores.existing = 0;
    scores.churned = Math.max(scores.churned, 80);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topLabel, topScore] = sorted[0];
  const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
  const confidence = totalScore > 0 ? Math.round((topScore / totalScore) * 100) / 100 : 0;

  const activeSignals: string[] = [];
  if (txCount > 0) activeSignals.push(`transactions=${txCount}`);
  if (context.asked_availability) activeSignals.push('asked_availability');
  if (context.asked_price) activeSignals.push('asked_price');
  if (context.said_expensive) activeSignals.push('said_expensive');
  if (ghostedTimes > 0) activeSignals.push(`ghosted=${ghostedTimes}x`);
  if (context.shared_photo) activeSignals.push('shared_photo');
  if (context.intent_level) activeSignals.push(`intent=${context.intent_level}`);

  return {
    label: topLabel,
    confidence,
    scores,
    reason: activeSignals.join(', ') || 'no signals',
    txCount,
    daysSinceLastChat,
    daysSinceLastTx,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Classify customer dan simpan ke Firestore.
 * Dirancang untuk dipanggil fire-and-forget setelah contextExtractor selesai.
 */
export async function classifyAndSaveCustomer(senderNumber: string): Promise<void> {
  if (!senderNumber) return;
  if (senderNumber === 'playground' || senderNumber === 'unknown') return;

  const docId = senderNumber.replace(/\D/g, '');
  if (!docId) return;

  const db = getDb();

  try {
    // 1. Fetch customerContext
    const ctxDoc = await db.collection('customerContext').doc(docId).get();
    const context = (ctxDoc.exists ? ctxDoc.data() : {}) as Record<string, unknown>;

    // 2. Fetch directMessages metadata
    const dmDoc = await db.collection('directMessages').doc(docId).get();
    const metadata = (dmDoc.exists ? dmDoc.data() : {}) as Record<string, unknown>;

    // 3. Fetch transactions
    const customerName = (metadata.name || context.customer_name) as string | undefined;
    const transactions = await getCustomerTransactions(docId, customerName);

    // 4. Update ghost count
    const ghostedTimes = await updateGhostedCount(docId, context, metadata);
    context.ghosted_times = ghostedTimes;

    // 5. Score
    const result = scoreCustomer(context, metadata, transactions);

    // 6. Save ke customerContext
    const update = {
      customer_label: result.label,
      label_confidence: result.confidence,
      label_reason: result.reason,
      label_scores: result.scores,
      follow_up_strategy: STRATEGY_MAP[result.label] || 'minimal',
      tx_count: result.txCount,
      days_since_last_chat: result.daysSinceLastChat,
      days_since_last_tx: result.daysSinceLastTx,
      label_updated_at: FieldValue.serverTimestamp(),
      labeled_by: 'classifier',
    };

    await db.collection('customerContext').doc(docId).set(update, { merge: true });

    // 7. Sync label ke directMessages untuk dashboard
    const frontendLabel = LABEL_MAPPING[result.label] || 'general';
    await db.collection('directMessages').doc(docId).set(
      {
        customerLabel: frontendLabel,
        labelReason: `AI Sync: ${result.label}`,
        labelUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(
      `[Classifier] ${docId} → ${result.label} (confidence: ${result.confidence}, reason: ${result.reason})`
    );
  } catch (error: any) {
    console.warn(`[Classifier] Error classifying ${docId}:`, error.message);
    // Fire-and-forget: jangan re-throw
  }
}
