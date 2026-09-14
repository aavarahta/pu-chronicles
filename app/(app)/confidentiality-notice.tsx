'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pu-chronicles-notice-ack';

// Shown once per browser session (sessionStorage, not localStorage) so it reappears
// each time someone starts a fresh session rather than being dismissed forever.
export default function ConfidentialityNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function acknowledge() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Confidential — Please Read
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          The trend of one year may not be the trend of the following year. It is to assist
          you in getting a sense of the kind of companies that frequently visit our campus.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          If it is found that this data is shared anywhere outside the campus or manipulated
          in any way, then strict actions will be taken.
        </p>
        <button
          onClick={acknowledge}
          className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          I understand
        </button>
      </div>
    </div>
  );
}
