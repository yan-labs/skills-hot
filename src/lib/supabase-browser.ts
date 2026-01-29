import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  // Allow pages to render (and `next build` to succeed) even when env vars are not set.
  // This is useful for CI/forks; auth will simply behave as "not signed in".
  const notConfiguredError = { message: 'Supabase is not configured.' } as any;

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      signOut: async () => ({ error: null }),
      signInWithOAuth: async () => ({ data: { url: null }, error: notConfiguredError }),
    },
  } as unknown as SupabaseClient;
}
