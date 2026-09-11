import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Server-side Supabase client for use in Server Components, Server Actions, and Route
// Handlers. Uses the anon key — RLS is deliberately locked down on every base table, so
// this client can only ever reach data through the SECURITY DEFINER functions in
// supabase/migrations/0001_init.sql, each of which re-checks the caller's email domain.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll called from a Server Component (not a Route Handler/Server Action)
            // — the middleware/proxy layer refreshes the session cookie instead.
          }
        },
      },
    }
  );
}
