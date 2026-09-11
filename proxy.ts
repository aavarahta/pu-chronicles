import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_EMAIL_DOMAIN = '@goa.bits-pilani.ac.in';

// First line of defense for the domain restriction — the authoritative check lives in
// the database (is_allowed_student() in supabase/migrations/0001_init.sql), so this is
// purely about giving non-domain users a clean redirect instead of a confusing app state.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');

  if (!user) {
    if (isAuthRoute) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const email = user.email?.toLowerCase() ?? '';
  if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
    await supabase.auth.signOut();
    if (isAuthRoute) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'domain');
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.delete('error');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
