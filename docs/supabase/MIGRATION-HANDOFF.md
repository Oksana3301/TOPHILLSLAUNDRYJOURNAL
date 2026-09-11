# Supabase migration — Top Hills

Updated 11 September 2026. Target: `dkiqgwziefazwrcieavq`, TOPHILLSLAUNDRYJOURNAL.

## Current checkpoint

The protected Edge API is deployed and its database health check returns HTTP 200.
All 18 PostgreSQL application tables exist with RLS enabled; browser roles have no direct grants.
The private bucket `top-hills-evidence` exists (10 MiB limit). The existing Site is still using D1/R2 until complete export/import verification and explicit runtime cutover.

## Architecture

The existing Site serves the application and proxies `/api/*` to `tophills-api`.
The Edge function verifies a separate 256-bit backend credential, original origin and path before restoring customer capabilities or trusted platform identity. It never accepts SQL from callers.
Only the credential SHA-256 hash appears in source. The current session encryption key is forwarded privately between servers, preserving encrypted sessions.

The Edge function uses Supabase-provided DB/key secrets. It executes application queries under `service_role`, with parameter binding and one transaction per D1-style batch. The original API retains all membership, customer capability, proof, audit and revision checks.
Direct public/authenticated Data API access is intentionally denied. The security advisor's informational RLS-without-policy findings reflect this server-only access model.

## Schema and recorded migrations

`supabase/schema.sql` contains the complete schema, preserving text JSON and IDs. Integer money, counters and session timestamps use bigint. There is no business seed.
The Supabase migration service recorded:

- `20260911121221 create_tophills_application_schema`
- `20260911121349 restrict_internal_rls_trigger_execution`

The second migration revokes public execution of the existing internal `rls_auto_enable()` event trigger. Its trigger behavior remains unchanged.
These are actual service-returned versions, not invented local migration filenames. Local tests apply schema.sql directly to disposable PGlite.

## Data groups

| Group | Tables |
|---|---|
| Workspace and accounts | workspace, members |
| Finance | finance_transactions, journals, journal_lines, attachments, finance_records, finance_audit, mutations |
| Laundry | laundry_rooms, laundry_orders, laundry_counters, laundry_events, laundry_proofs, laundry_mutations |
| Sessions and limits | staff_sessions, auth_limits |
| Historical practice | laundry_demo_sessions |

All JSON fields remain intact, including package lines, quote versions, PAY/SET/REF, operator exceptions, counters and audit history. Existing ChatGPT IDs and Supabase `sb:<uuid>` IDs remain separate; no email-based account merging occurs.

## Controlled cutover

1. Build and run all local suites, including the same finance/laundry/auth API scenarios on PostgreSQL.
2. Deploy the temporary export route with a fresh, expiring server credential. Migration mode pauses every API mutation and scheduled generator, including writes normally triggered by GET.
3. Export every table with keyset pagination. Never migrate truncated table-viewer output. Copy all proof bytes and preserve a private backup.
4. Import rows without changing IDs/revisions/text, compare table hashes/counts and proof hashes; verify ledger and account relationships.
5. Set `DATA_BACKEND=supabase`, retain the existing AUTH_SESSION_KEY, set the backend credential and remove the temporary export settings.
6. Publish the exact validated source, verify runtime database/Storage/Auth behavior, and remove training entry points.

There is no automatic fallback to D1/R2. Those sources remain untouched for rollback; after any new Supabase writes, rollback requires reconciling those writes first.

## Verification

- 62 existing finance, laundry and authentication API scenarios pass against local PostgreSQL/PGlite.
- 13 mocked diagnostic and backend boundary checks pass, including transaction rollback, credential isolation, export completeness, and deletion-stable Storage pagination.
- Existing Node.js 24 finance, laundry, auth and cache suites pass.
- GitHub Actions builds both backends and runs tests on local/fake data only. No deployment, secrets, production URLs or production database access in CI.

Actual email delivery, real user login and independent money reconciliation require the real account holders. QRIS payment-provider integration is separate and must never fabricate a successful payment.

The secret key previously shared in chat must be rotated in Supabase. Never commit or send server keys in chat.
