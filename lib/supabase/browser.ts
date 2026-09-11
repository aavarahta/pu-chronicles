import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client — used only by the login button to kick off the Google
// OAuth redirect. Nothing else in the app talks to Supabase from the client.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
