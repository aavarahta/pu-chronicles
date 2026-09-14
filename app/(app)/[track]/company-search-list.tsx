'use client';

import Link from 'next/link';
import { useState } from 'react';

type Company = { id: string; canonical_name: string };

export default function CompanySearchList({
  track,
  companies,
}: {
  track: string;
  companies: Company[];
}) {
  const [query, setQuery] = useState('');
  const filtered = companies.filter((c) =>
    c.canonical_name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search companies…"
        autoFocus
        className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-md placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          No companies match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {filtered.map((c) => (
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
