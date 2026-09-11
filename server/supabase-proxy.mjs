const fail = () => Response.json({error: 'Koneksi penyimpanan belum siap. Coba lagi sebentar.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
export async function proxySupabase(req, env, pathOverride) {
  const origin = new URL(req.url).origin;
  const configured = {
    url: /^https:\/\/[a-z]{20}\.supabase\.co$/.test(env.SUPABASE_URL || ''),
    backendCredential: /^[a-f0-9]{64}$/.test(env.SUPABASE_BACKEND_TOKEN || ''),
    sessionKey: /^[a-f0-9]{64}$/.test(env.AUTH_SESSION_KEY || '')
  };
  if (!Object.values(configured).every(Boolean)) {
    console.error('Top Hills backend configuration unavailable', JSON.stringify(configured));
    return fail();
  }
  const path = pathOverride || new URL(req.url).pathname + new URL(req.url).search;
  if (!pathOverride && path.startsWith('/api/__backend/')) return new Response(null, {status: 404});
  const headers = new Headers(req.headers);
  headers.delete('X-Top-Hills-Internal');
  if (pathOverride === '/api/__backend/scheduled') headers.set('X-Top-Hills-Internal', 'scheduled');
  // The Edge gateway sees only our server credential in Authorization.
  // The original customer bearer remains inside an authenticated server request.
  headers.set('X-Top-Hills-Customer-Authorization', req.headers.get('Authorization') || '');
  headers.set('Authorization', 'Bearer ' + env.SUPABASE_BACKEND_TOKEN);
  headers.set('X-Top-Hills-Source-Origin', origin);
  headers.set('X-Top-Hills-Source-Path', path);
  headers.set('X-Top-Hills-Session-Key', env.AUTH_SESSION_KEY);
  for (const name of ['Host', 'Content-Length', 'Connection', 'OAI-Sites-Authorization', 'Signature', 'Signature-Input', 'Signature-Agent', 'Cloudflare-Workers-Version-Key']) headers.delete(name);
  try {
    const response = await fetch(env.SUPABASE_URL + '/functions/v1/tophills-api', {
      method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      duplex: 'half', redirect: 'manual', signal: AbortSignal.timeout(45000)
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      console.error('Top Hills backend refused an upstream redirect');
      return fail();
    }
    const authCode = response.headers.get('X-Top-Hills-Auth-Code');
    if (response.status >= 400 && path.startsWith('/api/auth/') && /^[a-z_]{1,64}$/.test(authCode || '')) {
      console.warn('Top Hills authentication rejected', JSON.stringify({path: new URL(path, origin).pathname, status: response.status, code: authCode}));
    }
    const outputHeaders = new Headers(response.headers);
    // Internal transport credentials must never reach a client, even on errors.
    for (const name of [...outputHeaders.keys()]) if (/^x-top-hills-|^authorization$|^apikey$/i.test(name)) outputHeaders.delete(name);
    outputHeaders.set('Cache-Control', 'no-store');
    return new Response(response.body, {status: response.status, headers: outputHeaders});
  } catch (error) {
    console.error('Top Hills backend transport unavailable', error?.name || 'unknown');
    return fail();
  }
}
