# PU Chronicles

Interview and internship experience chronicles for BITS Pilani, K.K. Birla Goa Campus —
Placement Unit. Students sign in with their `@goa.bits-pilani.ac.in` Google account and
browse anonymized responses by Track (Placements / SIP) → Company.

## Architecture

- **Next.js 16 (App Router, TypeScript, Tailwind)**, deployed on Vercel.
- **Supabase** for Postgres + Auth (Google OAuth).
- No custom backend/API layer. Every student-facing read goes straight from a Server
  Component to Supabase via `@supabase/ssr`, protected entirely at the database level:
  base tables (`companies`, `field_definitions`, `responses`, `import_batches`) have RLS
  enabled with **zero grants** to `anon`/`authenticated` — the only way to read anything
  is through four `SECURITY DEFINER` functions (`list_companies`, `get_company`,
  `get_responses`, `list_visible_fields`) in `supabase/migrations/0001_init.sql`, each of
  which re-checks the caller's email domain itself. See that file for the full schema and
  security model.
- `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) is the first line of defense —
  it redirects signed-out or wrong-domain users before they see the app. The database
  checks are the authoritative ones; the proxy is just for UX.

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in from your Supabase project settings
npm run dev
```

`.env.local` needs four values — see `.env.local.example` for what goes where.
`SUPABASE_SERVICE_ROLE_KEY` is used **only** by `scripts/import.ts` and must never be set
in Vercel's environment variables.

## Importing chronicle data

Each cycle's raw Google Form export (`.xlsx`) gets imported with:

```bash
npm run import -- "<path to .xlsx>" --track=placements|sip --cycle="Sem 1 2025-26"
```

The importer maps raw column headers to a canonical schema via `scripts/column-map.ts` —
it refuses to import a file with a header it doesn't recognize rather than guessing, so
add new header variants there deliberately when a future cycle's form wording changes.
Company names are fuzzy-matched against what's already in the database; anything
ambiguous is either confirmed interactively (if run from a real terminal) or created as a
new company and listed in a "needs review" summary at the end (if run non-interactively).
Duplicate companies can be merged later directly in Supabase's Table Editor.

## Admin tasks (no admin panel by design)

There's deliberately no web admin UI. Do these directly in Supabase's dashboard:

- **Toggle field visibility**: `field_definitions` table, `visible_to_students` column.
  `email`, `name`, and `id_number` are `locked` and cannot be made visible (enforced by a
  database trigger, not just convention).
- **Merge duplicate companies**: pick the canonical row in `companies`, update any
  `responses.company_id` pointing at the duplicate, then delete the duplicate row.
- **Add an admin/coordinator email**: N/A — there's no privileged web role; anyone who
  can run `scripts/import.ts` needs the service role key, kept out of version control and
  out of Vercel.

## Deploying

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel's project
   environment variables — nothing else from `.env.local`.
2. In Supabase → Authentication → URL Configuration, set Site URL to the production URL
   and add `https://<production-url>/auth/callback` to Redirect URLs.
