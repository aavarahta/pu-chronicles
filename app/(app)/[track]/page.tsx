import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CompanySearchList from './company-search-list';

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
        <CompanySearchList track={track} companies={companies} />
      )}
    </div>
  );
}
