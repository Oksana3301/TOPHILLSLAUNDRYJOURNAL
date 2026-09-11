const fail = () => Response.json({error: 'Koneksi penyimpanan belum siap. Coba lagi sebentar.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
export async function proxySupabase(req, env, pathOverride) {
  const origin = new URL(req.url).origin;
  if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(env.SUPABASE_URL || '') ||
      !/^[a-f0-9]{64}$/.test(env.SUPABASE_BACKEND_TOKEN || '') ||
      !/^[a-f0-9]{64}$/.test(env.AUTH_SESSION_KEY || '')) return fail();
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
  headers.delete('Host'); headers.delete('Content-Length');
  try {
    const response = await fetch(env.SUPABASE_URL + '/functions/v1/tophills-api', {
      method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      duplex: 'half', redirect: 'error', signal: AbortSignal.timeout(45000)
    });
    const outputHeaders = new Headers(response.headers);
    // Internal transport credentials must never reach a client, even on errors.
    for (const name of [...outputHeaders.keys()]) if (/^x-top-hills-|^authorization$|^apikey$/i.test(name)) outputHeaders.delete(name);
    outputHeaders.set('Cache-Control', 'no-store');
    return new Response(response.body, {status: response.status, headers: outputHeaders});
  } catch { return fail(); }
}
