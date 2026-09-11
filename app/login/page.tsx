import GoogleSignInButton from './google-signin-button';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">PU Chronicles</h1>
        <p className="mt-1 text-sm text-slate-600">
          BITS Pilani, K.K. Birla Goa Campus — Placement Unit
        </p>
      </div>

      {error === 'domain' && (
        <p className="max-w-sm rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Access is restricted to BITS Goa student accounts (@goa.bits-pilani.ac.in). Please
          sign in with your university Google account.
        </p>
      )}

      <GoogleSignInButton />
    </main>
  );
}
