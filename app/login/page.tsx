import Image from 'next/image';
import GoogleSignInButton from './google-signin-button';
import ThemeToggle from '../theme-toggle';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-4 text-center">
      <Image
        src="/campus-background.webp"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-white/85 dark:bg-slate-950/85" />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            PU Chronicles
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            BITS Pilani, K.K. Birla Goa Campus — Placement Unit
          </p>
        </div>

        {error === 'domain' && (
          <p className="max-w-sm rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Access is restricted to BITS Goa student accounts (@goa.bits-pilani.ac.in). Please
            sign in with your university Google account.
          </p>
        )}

        <GoogleSignInButton />
      </div>
    </main>
  );
}
