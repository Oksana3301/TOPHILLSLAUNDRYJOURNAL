# Vercel backend activation

Updated 12 September 2026.

Production URL: https://tophillslaundryjournal.vercel.app
Supabase project: `dkiqgwziefazwrcieavq`.

## Routing and credentials

The dedicated Vercel adapter pins the verified Top Hills Supabase API URL. A missing,
malformed, or different `SUPABASE_URL` environment value cannot redirect backend credentials
or disable this dedicated adapter. The shared Sites proxy is unchanged.

Vercel Production still requires `TOP_HILLS_SITE_ORIGIN`, `SUPABASE_BACKEND_TOKEN`,
and `AUTH_SESSION_KEY`. The local `npm run setup:vercel` script remains compatible.
Only fingerprints are stored in `config/supabase-backend.json`; the secret values stay
in Vercel. The Edge gateway validates the origin, token fingerprint, and session-key
fingerprint together. Preview deployments cannot reach the production backend.
ChatGPT identity headers are stripped on the Vercel path.

## Applied backend change

Supabase `tophills-api` version 8 is ACTIVE. The uploaded files were retrieved and
matched exactly after deployment. This activation preserved the existing version 7
business-runtime bundle and entrypoint, replaced only its older gateway/configuration
block, and imports the reviewed `server/supabase-gateway.mjs` from commit `16c2175`
as a separate module. The existing `deno.json` and custom authentication were retained.
No business data or schema was migrated.

A future standard `npm run build:supabase` includes the gateway and client configuration
from source. Use the normal validated build for subsequent complete backend releases.

## Diagnosis and validation

The first fresh Vercel deployment still returned `enabled:false`. Private runtime
diagnostics identified `SUPABASE_URL` as invalid; origin, token/key format and production
environment passed their checks. Diagnostics contain status labels only, not secret values.

GitHub Actions runs the existing finance, laundry, auth, Supabase and Vercel suites,
including PostgreSQL parity. The endpoint-pinning regression verifies the actual proxy
target and credential headers with mocked transport and rejects missing credentials
and preview access. Passing automated tests does not establish a real account login.
