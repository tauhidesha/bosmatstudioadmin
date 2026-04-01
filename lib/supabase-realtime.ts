import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client dedicated to Realtime subscriptions.
 * Not used for data queries (Prisma handles that).
 * Only used client-side for listening to DB change events.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 2, // Rate limit to avoid excessive events
    },
  },
});
