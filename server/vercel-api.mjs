import {isIP} from 'node:net';
import {proxySupabase} from './supabase-proxy.mjs';

// This adapter serves only the verified Top Hills project; never route credentials using a host override.
const TOP_HILLS_SUPABASE_URL = 'https://dkiqgwziefazwrcieavq.supabase.co';
const MAX_BODY = 4250000;
const hexKey = value => /^[a-f0-9]{64}$/.test(value || '');
const json = (value, status = 200) => Response.json(value, {
  status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
});
function canonicalOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password ? value : null;
  } catch { return null; }
}
async function readBody(request) {
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}
export async function handleVercelApi(request, env, proxy = proxySupabase) {
  const url = new URL(request.url), routed = url.searchParams.getAll('__th_path');
  if (routed.length > 1) return json({error: 'Alamat API tidak valid.'}, 400);
  let path = routed.length ? '/api/' + routed[0] : url.pathname;
  url.searchParams.delete('__th_path');
  if (!/^\/api\/[a-zA-Z0-9/_-]+$/.test(path) || path.includes('//') ||
      path.startsWith('/api/__backend/') || path.startsWith('/api/laundry-demo/') ||
      path === '/api/maintenance/export' || path === '/api/bridge') {
    return json({error: 'Halaman tidak tersedia.'}, 404);
  }
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return json({error: 'Metode tidak tersedia.'}, 405);
  const origin = canonicalOrigin(env.TOP_HILLS_SITE_ORIGIN);
  const configured = !!origin && hexKey(env.SUPABASE_BACKEND_TOKEN) && hexKey(env.AUTH_SESSION_KEY);
  const production = !env.VERCEL_ENV || env.VERCEL_ENV === 'production';
  if (!configured || !production) {
    if (path === '/api/auth/config' && request.method === 'GET') {
      // Private runtime diagnostics: never log environment values, credentials or request headers.
      const settingStatus = (value, valid) => !value ? 'missing' : valid ? 'ready' : 'invalid';
      console.error('Top Hills Vercel configuration unavailable', JSON.stringify({
        TOP_HILLS_SITE_ORIGIN: settingStatus(env.TOP_HILLS_SITE_ORIGIN, !!origin),
        SUPABASE_BACKEND_TOKEN: settingStatus(env.SUPABASE_BACKEND_TOKEN, hexKey(env.SUPABASE_BACKEND_TOKEN)),
        AUTH_SESSION_KEY: settingStatus(env.AUTH_SESSION_KEY, hexKey(env.AUTH_SESSION_KEY)),
        production
      }));
      return json({enabled: false, chatgptEnabled: false, provider: 'Supabase Auth',
        message: 'Login sedang disiapkan. Silakan kembali setelah pengaturan selesai.'});
    }
    return json({error: 'Koneksi layanan sedang disiapkan. Perubahan belum disimpan.'}, 503);
  }
  if (url.origin !== origin) return json({error: 'Buka alamat utama Top Hills untuk melanjutkan.'}, 421);
  if (request.method === 'POST' &&
      (request.headers.get('Origin') !== origin || request.headers.get('X-Top-Hills') !== '1')) {
    return json({error: 'Permintaan lintas situs ditolak.'}, 403);
  }
  // Build an allowlist rather than trusting any platform identity/internal headers from the browser.
  const headers = new Headers();
  for (const name of ['Accept', 'Accept-Language', 'Content-Type', 'Origin', 'X-Top-Hills', 'User-Agent', 'Authorization']) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const cookie = request.headers.get('Cookie')?.split(';').map(s => s.trim())
    .find(s => s.startsWith('__Host-th-session='));
  if (cookie) headers.set('Cookie', cookie);
  // This field is set by Vercel's edge, not by the application client.
  const ip = (request.headers.get('x-vercel-forwarded-for') || '').split(',')[0].trim();
  // Cloudflare rejects its reserved IP header on external requests to Supabase.
  // Carry the validated edge IP as authenticated metadata; the gateway restores it internally.
  if (isIP(ip)) headers.set('X-Top-Hills-Client-IP', ip);
  try {
    const body = request.method === 'POST' ? await readBody(request) : undefined;
    if (body === null) return json({error: 'Unggahan terlalu besar. Pilih file maksimal 4 MB.'}, 413);
    const target = new URL(path + (url.searchParams.size ? '?' + url.searchParams : ''), origin);
    const upstream = await proxy(new Request(target, {method: request.method, headers, body}),
      {...env, SUPABASE_URL: TOP_HILLS_SUPABASE_URL});
    if (path === '/api/auth/config' && request.method === 'GET' && upstream.ok) {
      const config = await upstream.json();
      return json({...config, chatgptEnabled: false, maxUploadBytes: 4000000});
    }
    // Node fetch decodes compressed upstream bodies but may retain their wire headers.
    // Forward the decoded body with matching headers so errors, sessions and business JSON remain readable.
    const responseHeaders = new Headers(upstream.headers);
    for (const name of ['Content-Encoding', 'Content-Length', 'Transfer-Encoding']) responseHeaders.delete(name);
    return new Response(upstream.body, {status: upstream.status, statusText: upstream.statusText, headers: responseHeaders});
  } catch {
    return json({error: 'Layanan belum merespons. Perubahan belum dikonfirmasi tersimpan.'}, 503);
  }
}
