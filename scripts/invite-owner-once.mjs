// Temporary operator-requested invitation. Remove after the recorded operation completes.
// The live Edge operation independently binds the recipient, origin, expiry and durable send-once state.
if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production' &&
    !process.env.GITHUB_ACTIONS && Date.now() < Date.parse('2026-09-12T14:00:00Z')) {
  const origin = 'https://tophillslaundryjournal.vercel.app';
  const hex = value => /^[a-f0-9]{64}$/.test(value || '');
  if (process.env.TOP_HILLS_SITE_ORIGIN === origin && hex(process.env.SUPABASE_BACKEND_TOKEN) &&
      hex(process.env.AUTH_SESSION_KEY)) {
    try {
      const response = await fetch('https://dkiqgwziefazwrcieavq.supabase.co/functions/v1/tophills-owner-invite', {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(55000),
        headers: {'Content-Type': 'application/json',
          Authorization: 'Bearer ' + process.env.SUPABASE_BACKEND_TOKEN,
          'X-Top-Hills-Source-Origin': origin,
          'X-Top-Hills-Source-Path': '/api/__backend/owner-invite',
          'X-Top-Hills-Session-Key': process.env.AUTH_SESSION_KEY},
        body: JSON.stringify({operation: 'owner-email-20260912'})
      });
      const result = await response.json().catch(() => ({}));
      const code = /^[a-z_]{1,64}$/.test(result.code || '') ? result.code : 'invitation_result_unavailable';
      const userId = /^[a-f0-9-]{36}$/.test(result.userId || '') ? result.userId : undefined;
      console.log('Top Hills requested Owner invitation', JSON.stringify({
        status: response.status, code, userId, redirectReady: result.redirectReady === true,
        providerCode: /^[a-z_]{1,64}$/.test(result.providerCode || '') ? result.providerCode : undefined
      }));
    } catch {
      // Delivery may have happened before a transport failure. The Edge marker prevents an automatic resend.
      console.warn('Top Hills Owner invitation outcome requires checking its private operation state.');
    }
  }
}
