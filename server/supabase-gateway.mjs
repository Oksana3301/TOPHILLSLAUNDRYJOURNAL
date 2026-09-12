const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
function equalHash(actual, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected || '')) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
export async function backendRequest(req, {tokenHash, origin, clients = []}) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const sourceOrigin = req.headers.get('X-Top-Hills-Source-Origin');
  const actual = await sha256(token);
  // The original Sites credential remains restricted to its original origin.
  const sites = sourceOrigin === origin && equalHash(actual, tokenHash);
  const client = sites ? null : clients.find(c =>
    c.origin === sourceOrigin && equalHash(actual, c.tokenHash));
  if (!sites && !client) return null;
  const path = req.headers.get('X-Top-Hills-Source-Path') || '';
  const key = req.headers.get('X-Top-Hills-Session-Key') || '';
  if (!path.startsWith('/api/') || path.includes('\\') || !/^[a-f0-9]{64}$/.test(key)) return null;
  // New hosts use their own fixed session key. Existing Sites sessions are untouched.
  if (client && !equalHash(await sha256(key), client.sessionKeyHash)) return null;
  let url;
  try { url = new URL(path, sourceOrigin); } catch { return null; }
  if (url.origin !== sourceOrigin || !url.pathname.startsWith('/api/')) return null;
  const internal = sites && req.headers.get('X-Top-Hills-Internal') === 'scheduled';
  const headers = new Headers(req.headers), customer = headers.get('X-Top-Hills-Customer-Authorization');
  for (const name of [...headers.keys()]) {
    if (/^x-top-hills-|^authorization$|^apikey$/i.test(name) && name.toLowerCase() !== 'x-top-hills') headers.delete(name);
    // Only the authenticated Sites gateway may assert a ChatGPT identity.
    if (!sites && /^oai-|^signature(?:-|$)/i.test(name)) headers.delete(name);
  }
  if (customer) headers.set('Authorization', customer);
  return {request: new Request(url, {method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, duplex: 'half'}), sessionKey: key, internal};
}
