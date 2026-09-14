import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type FieldDef = { key: string; label: string; display_order: number };
type ResponseRow = { id: string; cycle_label: string; submitted_at: string | null; fields: Record<string, string> };

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ track: string; companyId: string }>;
}) {
  const { track, companyId } = await params;
  if (track !== 'placements' && track !== 'sip') notFound();

  const supabase = await createClient();

  const [{ data: companyRows, error: companyErr }, { data: responses, error: responsesErr }, { data: fieldDefs, error: fieldsErr }] =
    await Promise.all([
      supabase.rpc('get_company', { p_company_id: companyId }),
      supabase.rpc('get_responses', { p_company_id: companyId }),
      supabase.rpc('list_visible_fields'),
    ]);

  if (companyErr) throw companyErr;
  if (responsesErr) throw responsesErr;
  if (fieldsErr) throw fieldsErr;

  const company = companyRows?.[0];
  if (!company || company.track !== track) notFound();

  const fieldOrder: FieldDef[] = fieldDefs ?? [];

  return (
    <div>
      <Link
        href={`/${track}`}
        className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        &larr; Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">
        {company.canonical_name}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {(responses as ResponseRow[] | null)?.length ?? 0} response
        {(responses as ResponseRow[] | null)?.length === 1 ? '' : 's'}
      </p>

      <div className="mt-6 space-y-6">
        {(responses as ResponseRow[] | null)?.map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {r.cycle_label}
            </div>
            <dl className="space-y-4">
              {fieldOrder
                .filter((f) => r.fields[f.key])
                .map((f) => (
                  <div key={f.key}>
                    <dt className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {f.label}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
                      {r.fields[f.key]}
                    </dd>
                  </div>
                ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
