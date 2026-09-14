// One-off/repeatable company de-duplication tool. Reads a list of
// { track, canonical, members: [...] } groups from scripts/company-merges.json (each
// `members` entry is an EXACT existing companies.canonical_name — no fuzzy matching here,
// grouping is a human judgment call made once when authoring the JSON, not guessed at
// run time) and, for each group:
//   1. Picks (or creates) the canonical row.
//   2. Reassigns every responses.company_id pointing at another member onto it.
//   3. Merges all members' names into the canonical row's aliases.
//   4. Deletes the now-empty duplicate company rows.
//
// Usage: npm run merge-companies

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Group = { track: 'placements' | 'sip'; canonical: string; members: string[] };
const groups: Group[] = JSON.parse(readFileSync('scripts/company-merges.json', 'utf8'));

async function main() {
  let mergedGroups = 0;
  let deletedRows = 0;
  let responsesMoved = 0;

  for (const group of groups) {
    const { data: rows, error } = await supabase
      .from('companies')
      .select('id, canonical_name, aliases')
      .eq('track', group.track)
      .in('canonical_name', group.members);
    if (error) throw error;

    if (!rows || rows.length !== group.members.length) {
      const found = new Set((rows ?? []).map((r) => r.canonical_name));
      const missing = group.members.filter((m) => !found.has(m));
      console.error(
        `SKIPPING "${group.canonical}" (${group.track}): expected ${group.members.length} rows, found ${rows?.length ?? 0}. Missing: ${JSON.stringify(missing)}`
      );
      continue;
    }

    if (rows.length === 1) {
      // standalone rename only (typo/casing fix), no merge needed
      if (rows[0].canonical_name !== group.canonical) {
        const { error: renameErr } = await supabase
          .from('companies')
          .update({ canonical_name: group.canonical })
          .eq('id', rows[0].id);
        if (renameErr) throw renameErr;
        console.log(`Renamed (${group.track}): "${rows[0].canonical_name}" -> "${group.canonical}"`);
      }
      continue;
    }

    // Pick the row that already has the target name, if any; otherwise the first one.
    const canonicalRow = rows.find((r) => r.canonical_name === group.canonical) ?? rows[0];
    const duplicateRows = rows.filter((r) => r.id !== canonicalRow.id);

    const mergedAliases = Array.from(
      new Set([
        group.canonical,
        canonicalRow.canonical_name,
        ...canonicalRow.aliases,
        ...duplicateRows.flatMap((r) => [r.canonical_name, ...r.aliases]),
      ])
    );

    for (const dup of duplicateRows) {
      const { data: moved, error: moveErr } = await supabase
        .from('responses')
        .update({ company_id: canonicalRow.id })
        .eq('company_id', dup.id)
        .select('id');
      if (moveErr) throw moveErr;
      responsesMoved += moved?.length ?? 0;
    }

    const { error: updateErr } = await supabase
      .from('companies')
      .update({ canonical_name: group.canonical, aliases: mergedAliases })
      .eq('id', canonicalRow.id);
    if (updateErr) throw updateErr;

    const { error: deleteErr } = await supabase
      .from('companies')
      .delete()
      .in('id', duplicateRows.map((r) => r.id));
    if (deleteErr) throw deleteErr;

    deletedRows += duplicateRows.length;
    mergedGroups++;
    console.log(
      `Merged (${group.track}): [${group.members.join(', ')}] -> "${group.canonical}" (${duplicateRows.length} row(s) removed)`
    );
  }

  console.log(
    `\nDone. ${mergedGroups} group(s) merged, ${deletedRows} duplicate company row(s) deleted, ${responsesMoved} response(s) reassigned.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
