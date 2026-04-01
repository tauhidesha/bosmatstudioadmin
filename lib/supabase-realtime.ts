import { createClient } from '@supabase/supabase-js';
import { auth } from './auth/firebase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client dedicated to Realtime subscriptions.
 * Not used for data queries (Prisma handles that).
 * Uses Firebase Auth token to authenticate Realtime subscriptions against RLS.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 2, // Rate limit to avoid excessive events
    },
  },
  global: {
    fetch: fetch.bind(globalThis),
  },
  accessToken: async () => {
    // Return Firebase user's ID token to authenticate the Supabase Realtime connection
    const user = auth?.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken(false);
        return token;
      } catch (err) {
        console.error('[Supabase Realtime] Failed to get Firebase token', err);
        return '';
      }
    }
    return '';
  },
});
