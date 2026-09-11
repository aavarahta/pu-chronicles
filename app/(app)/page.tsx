import Link from 'next/link';

export default function TrackChooserPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">What are you looking for?</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/placements"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <h2 className="text-lg font-medium text-slate-900">Placements</h2>
          <p className="mt-1 text-sm text-slate-500">
            Full-time placement interview experiences, by company.
          </p>
        </Link>
        <Link
          href="/sip"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <h2 className="text-lg font-medium text-slate-900">SIP</h2>
          <p className="mt-1 text-sm text-slate-500">
            Summer internship interview experiences, by company.
          </p>
        </Link>
      </div>
    </div>
  );
}
