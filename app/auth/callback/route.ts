import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // proxy.ts checks the email domain on the very next request and redirects to
  // /login?error=domain if it's not @goa.bits-pilani.ac.in, so landing on "/" here is safe.
  return NextResponse.redirect(`${origin}/`);
}
