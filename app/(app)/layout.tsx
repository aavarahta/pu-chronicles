import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from './sign-out-button';

// proxy.ts already guarantees every request reaching here has a signed-in
// @goa.bits-pilani.ac.in session — this layout just renders the shared chrome.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/" className="font-semibold text-slate-900">
          PU Chronicles
        </Link>
        <div className="flex items-center gap-4">
          {user?.email && <span className="text-sm text-slate-500">{user.email}</span>}
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
