# Top Hills email login — integration and activation

## Current state

Routes and encrypted server sessions are implemented. The live Site uses project `dkiqgwziefazwrcieavq`, and `/api/auth/config` reports the Supabase Auth configuration enabled. This verifies runtime configuration, not email delivery or a completed user login. The existing ChatGPT Owner identity and approval rules are preserved; no real accounts or successful logins were fabricated.

Public Site routes reach the existing custom Worker through a protected Edge gateway; Supabase Auth is the external password verifier. The application retains server-side authorization through the existing members table. Business data now resides in PostgreSQL and private Supabase Storage; see `docs/supabase/MIGRATION-HANDOFF.md` for migration verification.

## Runtime configuration

Use Sites runtime environment settings, not browser storage or repository files:

- `SUPABASE_URL`: exact project origin, for example `https://project-ref.supabase.co`.
- `SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (`sb_publishable_…`) or legacy anon key. Service-role/secret keys are rejected and unnecessary.
- `AUTH_SESSION_KEY`: random 32-byte key encoded as 64 hex characters, stored as a runtime secret. Already generated for this Site. Never rotate casually: existing session ciphertext depends on it.

Deploy the saved version after changing environment values. The activation check requires all three values. A live connection test is still required after configuration; the check does not pretend to prove that a supplied key/project is valid.

## Supabase dashboard configuration

### Registration throttling and new devices

The live registration investigation on 11 September 2026 found HTTP 429 responses from `/api/auth/signup` while the application attempt counters were below their limits. The old wrapper discarded Supabase's specific error code. It therefore could not distinguish the provider's email quota from an IP/request limit. Do not diagnose a device problem from that old generic message.

The application now preserves allowlisted error codes and a valid `Retry-After`, with separate messages for email delivery limits, request throttling, email sender configuration, existing accounts and password requirements. The Sites proxy logs only operation, HTTP status and safe error code; it never logs credentials, email addresses or request bodies. No production rate limit or email-confirmation requirement was disabled.

Supabase's built-in email service currently allows only two messages per hour **per project**, and only to organization team addresses. A new device does not reset that quota. Check [SMTP settings](https://supabase.com/dashboard/project/dkiqgwziefazwrcieavq/auth/smtp) and [Auth rate limits](https://supabase.com/dashboard/project/dkiqgwziefazwrcieavq/auth/rate-limits). Custom SMTP configuration cannot be read or changed through the Supabase tools exposed in this session, and its current values have not been verified. Never infer an exact remaining cooldown when the provider does not return one.

Use **Masuk**, with the same identity/provider, to use an existing Owner account on another device. A different email is a separate account: after verification/login it appears under **Akses akun**, where an existing Owner can assign **Owner / Aktif**. Requested Owner in signup metadata is never an access grant.

Signup now returns to the confirmation step with the email retained and supports instructions for either an email link or a code. A provider-verified signup response starts the normal pending account/session instead of incorrectly asking the user to wait for an email that was not sent. Provider tokens in confirmation URL fragments are discarded; actual sign-in still verifies credentials on the server.

New tests cover two fresh devices sharing a provider email limit, successful verified signup and independent device sessions, pending Owner authorization, unconfirmed responses, existing-account/password/setup errors, per-email throttling and redaction of unknown provider errors. All use isolated SQLite/PostgreSQL fixtures and fake provider responses; they do not prove real email delivery.

### Required email settings

1. Enable email/password and require email confirmation.
2. Set Site URL to `https://top-hills-co-journal.atikadewi.chatgpt.site/login`.
3. Configure custom SMTP for staff email delivery. The default Supabase sender is only suitable for limited testing.
4. Signup can be confirmed through the email link, followed by password login at Top Hills. The UI also accepts explicit confirmation codes. For code-based signup and password recovery, display `{{ .Token }}` clearly in the Confirm signup and Reset password email templates. This integration does not consume implicit access-token callbacks. New Free projects using default SMTP cannot customize templates; configure custom SMTP first.
5. Check provider password policies and rate limits. Top Hills enforces 12–128 characters for new passwords and server-side attempt limits.
6. Test signup → code confirmation → pending approval → Owner activation → login from two devices → revoke one → reset password → all previous sessions rejected. Use test identities and no real payments.

## Accounts and permissions

New verified Supabase users map to stable `sb:<provider-user-id>` member IDs and start as Operator/Menunggu regardless of requested role. Requested Owner is information for review, not authorization. Existing active Owner selects actual role/status through Akses akun. No automatic linking based on matching email addresses: existing ChatGPT and Supabase identities remain separate until Owner explicitly grants access. Keep the original Owner account available during setup.

Passwords are forwarded to Supabase over HTTPS and are not stored in the application database, logs, localStorage, or cookies by Top Hills. Usernames/display names remain ordinary member metadata.

## Cookies, devices and sessions

- Each successful login creates a separate random 256-bit session. Only its hash is stored as the session key in the application database.
- Browser cookie: `__Host-th-session`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain, seven-day max age.
- Provider access/refresh tokens are AES-GCM encrypted server-side, never returned to browser JavaScript.
- Absolute lifetime seven days; idle timeout twelve hours. Server refreshes expiring provider access tokens with a database lease to limit concurrent refresh conflicts.
- Membership/role authorization remains checked by the business API. Disabling a member prevents subsequent business requests even if a session cookie remains.
- Users can list and revoke their own email sessions. Global logout/reset revokes Top Hills email sessions, not unrelated sessions on other products.
- Changing device requires login on that device. Cookies do not transfer; business data comes from PostgreSQL/Storage after authorization. Clearing cookies requires login again but does not delete server records.
- Changes to the Supabase project itself may not invalidate an already-issued local session until its provider token refresh. For immediate business access revocation, use Owner's member status controls or app session revocation.
- Use a direct top-level Site tab; third-party cookie restrictions can affect an embedded view.

## Cache and interaction changes

Sensitive API/auth responses use no-store. HTML uses no-store. Static JS/CSS/images use content ETags and must-revalidate: unchanged files can return 304 while changed application code is revalidated. No service worker/offline transaction queue is introduced.

Desk polling avoids overlapping loads, fetches room catalog at most once per minute in routine refresh, skips unchanged table rendering and pauses while a form, camera or editable input is active. Requests time out with a visible error, and online/offline events explain synchronization status. Back/forward restoration reloads protected staff pages to recheck authorization.

## Validation and remaining checks

Twenty-two authentication tests cover SQLite and local PostgreSQL with a mocked Supabase provider for signup/error handling, cookie flags, encrypted token persistence, pending Owner requests, two-device sessions, targeted/global revocation, idle timeout, refresh, CSRF, attempt limits and unconfirmed-email rejection. Existing finance/access/workflow regression tests pass. The published authentication configuration responds normally and unauthenticated staff access is rejected. These are not a real Supabase delivery/login test, a penetration test, or mobile browser QA. Check the actual Auth settings and email-code delivery before relying on email sign-in for operations.

Official references:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
