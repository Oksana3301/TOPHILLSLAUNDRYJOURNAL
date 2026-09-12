# Vercel build and migration status

The Vercel project `tophillslaundryjournal` imports this repository. The original build successfully produces `dist/`, but Vercel's default "Other" configuration searched for `public/` and rejected the deployment.

## Build configuration

`vercel.json` sets the build command to `npm run build && node scripts/package-vercel.mjs` and the output directory to `vercel-public`. Use the repository root and Node.js 24. The file takes precedence over the corresponding default project settings.

The packaging step copies authored static assets from `dist/` into disposable output. It excludes generated `dist/server/`, hidden hosting metadata and disabled training pages/scripts. It never deletes authored `dist/`. The login, laundry desk, check-in and SOP coverage URLs have explicit static rewrites. No catch-all rewrite masks API failures with HTML.

## Limits of this change

This fixes the output-directory build failure and packages the frontend. It does **not** finish the migration to Vercel. A deployment with status Ready confirms hosting/build success only.

- No Vercel API handler exists yet. Existing `/api/*` requests must be implemented through a protected server adapter before operational use.
- The existing Supabase Edge gateway accepts the configured Sites origin; Vercel requires a coordinated origin update that retains the old Site during transition.
- Never forward client-supplied `oai-authenticated-user-*` headers as trusted identity outside the Sites gateway.
- Verify Supabase email login and explicitly grant the appropriate existing account Owner access through an authorized Owner. Do not infer account linking from matching email addresses.
- Preserve the production session encryption key, backend credential, data, existing roles and private evidence storage.
- Vercel Functions have request/response payload limits that must be checked against the application's 10 MiB evidence upload limit before choosing the upload route.
- Supabase Function deployment is separate from a Vercel Git deployment. Validate frontend/backend compatibility together.
- The original Sites publication, audience and production database are not changed by this build fix. Continue using the working Sites URL for operations until migration checks pass.

Reference: https://vercel.com/docs/project-configuration/vercel-json
