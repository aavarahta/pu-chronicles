import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const TRACK_LABELS: Record<string, string> = {
  placements: 'Placements',
  sip: 'SIP',
};

export default async function TrackCompanyListPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track } = await params;
  if (track !== 'placements' && track !== 'sip') notFound();

  const supabase = await createClient();
  const { data: companies, error } = await supabase.rpc('list_companies', { p_track: track });
  if (error) throw error;

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        &larr; Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">
        {TRACK_LABELS[track]}
      </h1>

      {!companies || companies.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          No companies yet for this track.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {companies.map((c: { id: string; canonical_name: string }) => (
            <li key={c.id}>
              <Link
                href={`/${track}/${c.id}`}
                className="block px-5 py-3 text-slate-800 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {c.canonical_name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
