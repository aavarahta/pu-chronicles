// Import pipeline: parses one raw chronicle .xlsx, maps its columns to the canonical
// schema (scripts/column-map.ts), resolves/merges company names against what's already
// in the database, and inserts one `responses` row per student.
//
// Usage:
//   npm run import -- "<path to .xlsx>" --track=placements --cycle="Sem 1 2025-26"
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (service role only
// — this script is the one place in the project that bypasses RLS; it never runs in the
// deployed app).

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' }); // dotenv/config alone only reads .env, not .env.local
import path from 'node:path';
import * as readline from 'node:readline/promises';
import ExcelJS from 'exceljs';
import { distance } from 'fastest-levenshtein';
import { createClient } from '@supabase/supabase-js';
import { HEADER_MAP, normalizeHeader, TIMESTAMP, COMPANY } from './column-map';

// ── CLI args ─────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));
const trackArg = args.find((a) => a.startsWith('--track='))?.split('=')[1];
const cycleArg = args.find((a) => a.startsWith('--cycle='))?.split('=')[1];

if (!filePath || (trackArg !== 'placements' && trackArg !== 'sip') || !cycleArg) {
  console.error(
    'Usage: npm run import -- "<file.xlsx>" --track=placements|sip --cycle="Sem 1 2025-26"'
  );
  process.exit(1);
}
const track = trackArg as 'placements' | 'sip';
const cycleLabel = cycleArg;
const sourceFile = path.basename(filePath);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Cell value helpers ───────────────────────────────────────────────────────────────

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('text' in value) return String((value as { text: unknown }).text);
    if ('result' in value) return String((value as { result: unknown }).result ?? '');
  }
  return String(value).trim();
}

function cellToDate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// ── Company name normalization + fuzzy matching ─────────────────────────────────────

function companyMatchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[().,]/g, ' ')
    .replace(
      /\b(technologies|technology|pvt|private|ltd|limited|inc|incorporated|corp|corporation|llc|india)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const d = distance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - d / maxLen;
}

type CompanyRow = { id: string; canonical_name: string; aliases: string[] };

async function loadExistingCompanies(): Promise<CompanyRow[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, canonical_name, aliases')
    .eq('track', track);
  if (error) throw error;
  return data ?? [];
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const INTERACTIVE = process.stdin.isTTY === true;
const needsReview: string[] = [];

async function resolveCompany(
  rawNameInput: string,
  existing: CompanyRow[],
  resolutionCache: Map<string, string>
): Promise<string> {
  const rawName = rawNameInput.trim().replace(/\s+/g, ' ');
  const cached = resolutionCache.get(rawName);
  if (cached) return cached;

  const key = companyMatchKey(rawName);

  // exact alias match
  for (const c of existing) {
    if (c.aliases.some((a) => companyMatchKey(a) === key)) {
      resolutionCache.set(rawName, c.id);
      return c.id;
    }
  }

  let best: { company: CompanyRow; score: number } | null = null;
  for (const c of existing) {
    const score = similarity(key, companyMatchKey(c.canonical_name));
    if (!best || score > best.score) best = { company: c, score };
  }

  let targetId: string;
  if (best && best.score >= 0.92) {
    targetId = best.company.id;
  } else if (best && best.score >= 0.6) {
    if (INTERACTIVE) {
      const answer = await rl.question(
        `  "${rawName}" looks similar to existing company "${best.company.canonical_name}" ` +
          `(similarity ${Math.round(best.score * 100)}%). Same company? [y/N] `
      );
      if (answer.trim().toLowerCase().startsWith('y')) {
        targetId = best.company.id;
      } else {
        targetId = await createCompany(rawName, existing);
      }
    } else {
      // Non-interactive (e.g. run by an agent): never silently merge on a guess.
      // Create as a new company and flag it for the coordinator to merge manually
      // in the Supabase Table Editor if it really is a duplicate.
      needsReview.push(
        `"${rawName}" vs existing "${best.company.canonical_name}" (${Math.round(best.score * 100)}% similar)`
      );
      targetId = await createCompany(rawName, existing);
    }
  } else {
    targetId = await createCompany(rawName, existing);
  }

  resolutionCache.set(rawName, targetId);
  const company = existing.find((c) => c.id === targetId);
  if (company && !company.aliases.some((a) => companyMatchKey(a) === key)) {
    company.aliases.push(rawName);
    await supabase.from('companies').update({ aliases: company.aliases }).eq('id', targetId);
  }
  return targetId;
}

async function createCompany(rawName: string, existing: CompanyRow[]): Promise<string> {
  const { data, error } = await supabase
    .from('companies')
    .insert({ track, canonical_name: rawName, aliases: [rawName] })
    .select('id, canonical_name, aliases')
    .single();
  if (error) throw error;
  existing.push(data);
  console.log(`  + new company: "${rawName}"`);
  return data.id;
}

// ── Main ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Importing ${sourceFile} (track=${track}, cycle="${cycleLabel}")`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath!);
  const sheet = workbook.worksheets[0];

  // Map each column index -> target (TIMESTAMP | COMPANY | canonical key | null-ignore).
  // Any non-empty header that isn't in HEADER_MAP aborts the import rather than guessing.
  const headerRow = sheet.getRow(1);
  const columnTargets = new Map<number, string | null>();
  const unrecognized: string[] = [];
  for (let col = 1; col <= sheet.actualColumnCount; col++) {
    const raw = cellToString(headerRow.getCell(col).value);
    if (!raw) continue; // trailing blank header cells — skip, not an error
    const normalized = normalizeHeader(raw);
    if (!(normalized in HEADER_MAP)) {
      unrecognized.push(raw);
      continue;
    }
    columnTargets.set(col, HEADER_MAP[normalized]);
  }
  if (unrecognized.length > 0) {
    console.error('Unrecognized column header(s) — add these to scripts/column-map.ts first:');
    for (const h of unrecognized) console.error(`  - ${JSON.stringify(h)}`);
    process.exit(1);
  }

  const existingCompanies = await loadExistingCompanies();
  const resolutionCache = new Map<string, string>();

  let inserted = 0;
  let skippedDuplicate = 0;
  let skippedEmpty = 0;

  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    if (row.actualCellCount === 0) continue;

    let submittedAt: string | null = null;
    let companyRaw: string | null = null;
    const fields: Record<string, string> = {};

    for (const [col, target] of columnTargets) {
      const value = row.getCell(col).value;
      if (target === TIMESTAMP) {
        submittedAt = cellToDate(value);
      } else if (target === COMPANY) {
        const s = cellToString(value);
        if (s) companyRaw = s;
      } else if (target) {
        const s = cellToString(value);
        if (s) fields[target] = s;
      }
    }

    if (!companyRaw) {
      skippedEmpty++;
      continue;
    }

    const companyId = await resolveCompany(companyRaw, existingCompanies, resolutionCache);

    // idempotency: skip if this exact (company, submitted_at, source_file) already exists
    const { data: dupe, error: dupeErr } = await supabase
      .from('responses')
      .select('id')
      .eq('company_id', companyId)
      .eq('source_file', sourceFile)
      .eq('submitted_at', submittedAt)
      .maybeSingle();
    if (dupeErr) throw dupeErr;
    if (dupe) {
      skippedDuplicate++;
      continue;
    }

    const { error: insertErr } = await supabase.from('responses').insert({
      company_id: companyId,
      track,
      cycle_label: cycleLabel,
      submitted_at: submittedAt,
      source_file: sourceFile,
      data: fields,
    });
    if (insertErr) throw insertErr;
    inserted++;
  }

  await supabase.from('import_batches').insert({
    source_file: sourceFile,
    track,
    cycle_label: cycleLabel,
    row_count: inserted,
  });

  console.log(
    `Done. Inserted ${inserted}, skipped ${skippedDuplicate} duplicate(s), ${skippedEmpty} empty row(s).`
  );
  if (needsReview.length > 0) {
    console.log(`\nPossible duplicate companies — created as new, review manually if needed:`);
    for (const line of needsReview) console.log(`  - ${line}`);
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
