# Top Hills email login — integration and activation

## Current state

Routes and encrypted server sessions are implemented, but email login stays disabled until a real Supabase Auth project is configured. No project, user, email delivery or successful external login is simulated in production. Existing ChatGPT sign-in and Owner approvals continue to work.

This extends the existing custom Worker rather than installing an authentication starter. Public Site routes reach the application; Supabase Auth is the external password verifier. The application retains server-side authorization through the existing members table. D1/R2 business data is not migrated to Supabase.

## Runtime configuration

Use Sites runtime environment settings, not browser storage or repository files:

- `SUPABASE_URL`: exact project origin, for example `https://project-ref.supabase.co`.
- `SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (`sb_publishable_…`) or legacy anon key. Service-role/secret keys are rejected and unnecessary.
- `AUTH_SESSION_KEY`: random 32-byte key encoded as 64 hex characters, stored as a runtime secret. Already generated for this Site. Never rotate casually: existing session ciphertext depends on it.

Deploy the saved version after changing environment values. The activation check requires all three values. A live connection test is still required after configuration; the check does not pretend to prove that a supplied key/project is valid.

## Supabase dashboard configuration

1. Enable email/password and require email confirmation.
2. Set Site URL to `https://top-hills-co-journal.atikadewi.chatgpt.site/login`.
3. Configure custom SMTP for staff email delivery. The default Supabase sender is only suitable for limited testing.
4. The Top Hills UI uses explicit email codes. In both Confirm signup and Reset password email templates, display `{{ .Token }}` clearly, with instructions to enter the code at the Top Hills login page. Do not rely on an implicit access-token hash callback, which this integration does not consume.
5. Check provider password policies and rate limits. Top Hills enforces 12–128 characters for new passwords and server-side attempt limits.
6. Test signup → code confirmation → pending approval → Owner activation → login from two devices → revoke one → reset password → all previous sessions rejected. Use test identities and no real payments.

## Accounts and permissions

New verified Supabase users map to stable `sb:<provider-user-id>` member IDs and start as Operator/Menunggu regardless of requested role. Requested Owner is information for review, not authorization. Existing active Owner selects actual role/status through Akses akun. No automatic linking based on matching email addresses: existing ChatGPT and Supabase identities remain separate until Owner explicitly grants access. Keep the original Owner account available during setup.

Passwords are forwarded to Supabase over HTTPS and are not stored in D1, logs, localStorage, or cookies by Top Hills. Usernames/display names remain ordinary member metadata.

## Cookies, devices and sessions

- Each successful login creates a separate random 256-bit session. Only its hash is stored as the session key in D1.
- Browser cookie: `__Host-th-session`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain, seven-day max age.
- Provider access/refresh tokens are AES-GCM encrypted server-side, never returned to browser JavaScript.
- Absolute lifetime seven days; idle timeout twelve hours. Server refreshes expiring provider access tokens with a database lease to limit concurrent refresh conflicts.
- Membership/role authorization remains checked by the business API. Disabling a member prevents subsequent business requests even if a session cookie remains.
- Users can list and revoke their own email sessions. Global logout/reset revokes Top Hills email sessions, not unrelated sessions on other products.
- Changing device requires login on that device. Cookies do not transfer; business data comes from D1/R2 after authorization. Clearing cookies requires login again but does not delete server records.
- Changes to the Supabase project itself may not invalidate an already-issued local session until its provider token refresh. For immediate business access revocation, use Owner's member status controls or app session revocation.
- Use a direct top-level Site tab; third-party cookie restrictions can affect an embedded view.

## Cache and interaction changes

Sensitive API/auth responses use no-store. HTML uses no-store. Static JS/CSS/images use content ETags and must-revalidate: unchanged files can return 304 while changed application code is revalidated. No service worker/offline transaction queue is introduced.

Desk polling avoids overlapping loads, fetches room catalog at most once per minute in routine refresh, skips unchanged table rendering and pauses while a form, camera or editable input is active. Requests time out with a visible error, and online/offline events explain synchronization status. Back/forward restoration reloads protected staff pages to recheck authorization.

## Validation and remaining checks

Thirteen local tests use SQLite and a mocked Supabase provider for cookie flags, encrypted token persistence, pending Owner requests, two-device sessions, targeted/global revocation, idle timeout, refresh, CSRF, attempt limits and unconfirmed-email rejection. Existing finance/access/workflow regression tests pass. These are not a real Supabase delivery/login test, a penetration test, or mobile browser QA. Live activation must wait for the actual project settings and email delivery configuration.

Official references:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
