# Supabase migration — Top Hills

Updated 11 September 2026. Target: `dkiqgwziefazwrcieavq`, TOPHILLSLAUNDRYJOURNAL.

## Current checkpoint

The protected Edge API is deployed and its database health check returns HTTP 200.
All 18 PostgreSQL application tables exist with RLS enabled; browser roles have no direct grants.
The private bucket `top-hills-evidence` exists (10 MiB limit). Complete source export and import have been verified across all 18 tables, including every field fingerprint, original ID, revision and owner record. A private full backup is retained. The source object inventory is empty.

Site version 11 is published with `DATA_BACKEND=supabase`. Its public authentication configuration responds HTTP 200, and protected staff APIs reject unauthenticated access. A server-authenticated, read-only request using the preserved Owner identity returns a valid laundry summary from the deployed PostgreSQL backend. This service check is not a real browser login. The training routes and temporary export access are closed.

## Architecture

The existing Site serves the application and proxies `/api/*` to `tophills-api`.
The Edge function verifies a separate 256-bit backend credential, original origin and path before restoring customer capabilities or trusted platform identity. It never accepts SQL from callers.
Only the credential SHA-256 hash appears in source. The session encryption key is forwarded privately between servers. A fresh key was installed after confirming there were no encrypted staff sessions to preserve. Future rotation requires handling existing sessions explicitly.

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
5. Set `DATA_BACKEND=supabase`, preserve the session encryption key when encrypted sessions exist, set the backend credential and remove the temporary export settings.
6. Publish the exact validated source, verify runtime database/Storage/Auth behavior, and remove training entry points.

There is no automatic fallback to D1/R2. Those sources remain untouched for rollback; after any new Supabase writes, rollback requires reconciling those writes first.

## Verification

- 62 existing finance, laundry and authentication API scenarios pass against local PostgreSQL/PGlite.
- 15 mocked diagnostic and backend boundary checks pass, including transaction rollback, credential isolation, export completeness, redirect rejection, and deletion-stable Storage pagination.
- Existing Node.js 24 finance, laundry, auth and cache suites pass.
- GitHub Actions builds both backends and runs tests on local/fake data only. No deployment, secrets, production URLs or production database access in CI.
- A real temporary Storage probe verified upload, private read, listing and deletion; unauthenticated public access was denied. Probe objects and the temporary probe endpoint were removed.
- The initial Site-to-Edge proxy returned HTTP 503. Version 11 strips transport/platform headers and handles upstream redirects explicitly; live requests now reach the application. No data re-import was needed.

Runtime source: GitHub `47562a88fa2c72dc11857bbf697133f1418f0072`, Sites merge `7a81359796de54ff2f812e1f1badf6fcc2bfa47e`. [Node.js 24 CI passed](https://github.com/Oksana3301/TOPHILLSLAUNDRYJOURNAL/actions/runs/34600941759). Later documentation commits do not deploy a new runtime.

Actual email delivery, real user login and independent money reconciliation require the real account holders. QRIS payment-provider integration is separate and must never fabricate a successful payment.

Start the account trial at `/login` with the existing Owner's **Masuk dengan ChatGPT** identity. Email accounts require the Auth configuration and code-delivery checks in `AUTH-SETUP.md`; newly registered accounts await Owner approval. Test on the real phone before relying on camera/QR capture. Readiness confirmations remain unconfirmed until those checks are actually performed.

The secret key previously shared in chat must be rotated in Supabase. Never commit or send server keys in chat.
