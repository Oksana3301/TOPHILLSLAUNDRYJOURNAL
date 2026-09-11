const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
export async function backendRequest(req, {tokenHash, origin}) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(tokenHash || '')) return null;
  const actual = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  let diff = 0; for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ tokenHash.charCodeAt(i);
  if (diff || req.headers.get('X-Top-Hills-Source-Origin') !== origin) return null;
  const path = req.headers.get('X-Top-Hills-Source-Path') || '';
  const key = req.headers.get('X-Top-Hills-Session-Key') || '';
  if (!path.startsWith('/api/') || path.includes('\\') || !/^[a-f0-9]{64}$/.test(key)) return null;
  const url = new URL(path, origin);
  if (url.origin !== origin || !url.pathname.startsWith('/api/')) return null;
  const internal = req.headers.get('X-Top-Hills-Internal') === 'scheduled';
  const headers = new Headers(req.headers), customer = headers.get('X-Top-Hills-Customer-Authorization');
  for (const name of [...headers.keys()]) if (/^x-top-hills-|^authorization$|^apikey$/i.test(name) && name.toLowerCase() !== 'x-top-hills') headers.delete(name);
  if (customer) headers.set('Authorization', customer);
  return {request: new Request(url, {method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, duplex: 'half'}), sessionKey: key, internal};
}
