/**
 * Conversation Memory — baca history dari Firestore
 * Diport dari app.js: getConversationHistory + buildLangChainHistory
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { getDb } from '@/lib/server/firebase-admin';

export interface MessageEntry {
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp: FirebaseFirestore.Timestamp | null;
}

/**
 * Ambil conversation history dari Firestore
 * Sama persis dengan app.js getConversationHistory()
 */
export async function getConversationHistory(
  senderNumber: string,
  limit = 4
): Promise<MessageEntry[]> {
  const db = getDb();
  if (!db) return [];

  // Normalize: hapus semua non-digit, lalu gunakan sebagai docId
  const docId = senderNumber.replace(/\D/g, '');
  if (!docId) return [];

  try {
    const messagesRef = db
      .collection('directMessages')
      .doc(docId)
      .collection('messages');

    const snapshot = await messagesRef
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const messages: MessageEntry[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        text: data.text || '',
        sender: data.sender,
        timestamp: data.timestamp || null,
      });
    });

    // Return dalam urutan kronologis (oldest first)
    return messages.reverse();
  } catch (error: any) {
    console.warn('[Memory] getConversationHistory error:', error.message);
    return [];
  }
}

/**
 * Konversi history array → LangChain message objects
 * Sama persis dengan app.js buildLangChainHistory()
 */
export function buildLangChainHistory(
  history: MessageEntry[]
): (HumanMessage | AIMessage)[] {
  if (!history || history.length === 0) return [];

  const formatted: (HumanMessage | AIMessage)[] = [];

  history.forEach((entry) => {
    const text = (entry.text || '').trim();
    if (!text) return;

    if (entry.sender === 'ai' || entry.sender === 'admin') {
      formatted.push(new AIMessage(text));
    } else {
      formatted.push(new HumanMessage(text));
    }
  });

  return formatted;
}

/**
 * Cek apakah pesan pendek/ambigu → perlu history
 * Sama logika dengan app.js isShortOrAmbiguous
 */
export function isShortOrAmbiguous(userMessage: string): boolean {
  const wordCount = userMessage.trim().split(/\s+/).length;
  return (
    wordCount < 8 ||
    /^(oke|iya|gas|terus|jadi|boleh|harganya|kapan|jam berapa|besok|y|ok|sip|siap|mantap)$/i.test(
      userMessage.trim()
    )
  );
}
