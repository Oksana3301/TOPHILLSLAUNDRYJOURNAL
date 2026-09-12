# Vercel and Supabase connection

Canonical Vercel URL: https://tophillslaundryjournal.vercel.app
Supabase project: dkiqgwziefazwrcieavq
Existing Sites URL: https://top-hills-co-journal.atikadewi.chatgpt.site

## Code readiness

The repository includes the Vercel public-asset build, page rewrites and a protected server adapter for /api/*. The adapter keeps all database access inside the existing Supabase Edge API. It does not need a database password, service-role key or Supabase personal access token in Vercel.

The gateway source supports separate, origin-bound credentials for additional hosts. The original Sites origin/token and its trusted identity path remain intact. Adding source support alone does not activate a Vercel credential or deploy the Edge function. Do not claim a completed migration before provisioning and live checks succeed.

## Provision once on the owner's Mac

From the repository root with Node.js 24:

    git pull --ff-only origin main
    npm run setup:vercel -- --copy

The script creates .env.vercel.local with filesystem mode 0600, reuses it on later runs and copies its content to the Mac clipboard. It never prints the secrets. The existing .env.* Git ignore rule excludes this file.

Paste/import that content into the Vercel project’s Environment Variables, scoped to **Production only**:

| Variable | Source |
| --- | --- |
| TOP_HILLS_SITE_ORIGIN | https://tophillslaundryjournal.vercel.app |
| SUPABASE_URL | https://dkiqgwziefazwrcieavq.supabase.co |
| SUPABASE_BACKEND_TOKEN | New random 32-byte hex secret generated locally |
| AUTH_SESSION_KEY | Separate random 32-byte hex secret generated locally |

Do not put these in browser code, logs, a public repository or chat. Do not reuse the production credentials in Preview environments. Do not regenerate or change these secrets casually after activation.

The terminal also prints a JSON report containing origin, tokenHash and sessionKeyHash. Only that report is safe to share for backend registration. Hashes authorize no request without the corresponding secrets.

## Backend registration and release

1. Validate the report against the exact canonical Vercel origin above.
2. Add its object to config/supabase-backend.json under clients, keeping the original origin/tokenHash unchanged.
3. Build and test the exact revision with npm run build, npm run test:vercel, the existing suites, and npm run build:supabase. The compiled Edge entry and deno.json are under .sites-runtime/supabase/.
4. Deploy those compiled files to the existing tophills-api function. Preserve its custom-auth verify_jwt=false setting and every existing Supabase secret. Do not apply schema migrations or seed/reset business data.
5. Redeploy the Vercel Production deployment after environment settings are saved.
6. Verify /api/auth/config reports enabled=true, anonymous business requests return 401, and real Owner sign-in opens the existing workspace. Check a controlled transaction with the account holder before operational cutover.

## Identity and sessions

New-host credentials cannot assert oai-authenticated-user-* headers. Both the Vercel adapter and backend strip those assertions; only the original Sites credential may retain its existing trusted identity path.

Vercel uses Supabase email/password and the existing sb:<uuid> member record. No role or account is linked merely because email addresses match. A pre-existing active Supabase Owner needs no new signup.

Each host sets its own __Host-th-session cookie. Vercel's new sessions use its dedicated encryption key, bound by sessionKeyHash. The existing Sites key and sessions stay in place. Users sign in once on the new domain; cookies do not transfer between hosts.

## Supabase Auth dashboard

Keep the Sites redirect URL available during transition. Add this exact permitted redirect:

    https://tophillslaundryjournal.vercel.app/login

The application supplies that redirect explicitly. The default Supabase Site URL can stay on Sites during transition and move to Vercel at cutover.

Existing confirmed email/password accounts can sign in without sending a new confirmation email. Signup, recovery and resend still require working SMTP delivery; verify custom SMTP before relying on them.

## Upload and runtime boundaries

- Vercel Functions accept at most 4.5 MB request/response payloads. The Vercel frontend restricts files to 4 MB; the adapter rejects bodies above 4.25 MB before forwarding. Sites keeps its existing limits.
- Existing larger attachments may require the original Site until a separate authorized direct-storage download/upload flow is implemented. Their stored objects are not modified.
- This deployment does not activate QRIS, payment-provider or WhatsApp integrations.
- Preview deployments fail closed instead of receiving production credentials.
- An upstream error never produces a successful-save message or a database fallback.
- The existing scheduled/on-access report behavior is not reconfigured here.
- Business data and evidence remain in the same PostgreSQL database and private Storage bucket.

## Checks

The CI suite exercises the adapter with mocked transport and isolated SQLite/PostgreSQL fixtures: real session creation, Owner authorization, transaction retry behavior, logout, forged identity rejection, cross-origin rejection, secret isolation and size limits. Local provisioning is checked for idempotence and no secret output. These tests do not establish real password login, email delivery or payment processing.

References:
- https://vercel.com/docs/environment-variables/managing-environment-variables
- https://vercel.com/docs/functions/limitations
- https://supabase.com/docs/guides/auth/redirect-urls
