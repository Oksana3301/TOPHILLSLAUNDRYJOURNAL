import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// Read-only production deployment verification; CI and previews never contact live services.
if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production' && !process.env.GITHUB_ACTIONS) {
  const origin = 'https://tophillslaundryjournal.vercel.app';
  const fingerprint = value => /^[a-f0-9]{64}$/.test(value || '')
    ? createHash('sha256').update(value).digest('hex') : null;
  try {
    const config = JSON.parse(await readFile(new URL('../config/supabase-backend.json', import.meta.url), 'utf8'));
    const client = config.clients?.find(value => value.origin === origin);
    const checks = {
      originMatches: process.env.TOP_HILLS_SITE_ORIGIN === origin,
      tokenMatches: !!client && fingerprint(process.env.SUPABASE_BACKEND_TOKEN) === client.tokenHash,
      sessionKeyMatches: !!client && fingerprint(process.env.AUTH_SESSION_KEY) === client.sessionKeyHash
    };
    console.log('Top Hills backend credential checks', JSON.stringify(checks));
    if (Object.values(checks).every(Boolean)) {
      const {handleVercelApi} = await import('../server/vercel-api.mjs');
      const response = await handleVercelApi(new Request(origin + '/api/auth/config'), process.env);
      let enabled = false, chatgptEnabled = false;
      if (response.ok) {
        const config = await response.json();
        enabled = config.enabled === true;
        chatgptEnabled = config.chatgptEnabled === true;
      } else await response.body?.cancel();
      console.log('Top Hills authenticated backend probe', JSON.stringify({status: response.status, enabled, chatgptEnabled}));
      const publicResponse = await fetch(origin + '/api/auth/config', {
        redirect: 'manual', signal: AbortSignal.timeout(15000)
      });
      let publicEnabled = false;
      if (publicResponse.ok && publicResponse.headers.get('content-type')?.includes('application/json')) {
        publicEnabled = (await publicResponse.json()).enabled === true;
      } else await publicResponse.body?.cancel();
      console.log('Top Hills public login probe', JSON.stringify({status: publicResponse.status, enabled: publicEnabled}));
    }
  } catch {
    // Never emit exception messages, response bodies or environment values.
    console.warn('Top Hills backend verification could not complete; verify runtime separately.');
  }
}
