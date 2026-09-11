export const EVIDENCE_BUCKET = 'top-hills-evidence';
export class SupabaseStorage {
  constructor({url, key, DB, request = fetch}) {
    if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(url) || !key) throw new Error('Storage configuration unavailable');
    Object.assign(this, {url, key, DB, request});
  }
  path(key) {
    if (typeof key !== 'string' || !key || key.length > 1024 || key.split('/').some(p => !p || p === '.' || p === '..') || /[\\\x00-\x1f]/.test(key)) throw new Error('Invalid object key');
    return key.split('/').map(encodeURIComponent).join('/');
  }
  async send(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('apikey', this.key);
    if (!this.key.startsWith('sb_secret_')) headers.set('Authorization', 'Bearer ' + this.key);
    const response = await this.request(this.url + '/storage/v1/' + path, {...options, headers, redirect: 'error', signal: AbortSignal.timeout(30000)});
    if (!response.ok && response.status !== 404) throw new Error('Evidence storage request failed (' + response.status + ')');
    return response;
  }
  async put(key, bytes, options = {}) {
    const r = await this.send('object/' + EVIDENCE_BUCKET + '/' + this.path(key), {method: 'POST', body: bytes,
      headers: {'Content-Type': options.httpMetadata?.contentType || 'application/octet-stream', 'x-upsert': 'false'}});
    if (!r.ok) throw new Error('Evidence bucket unavailable');
    await r.arrayBuffer();
  }
  async get(key) {
    const r = await this.send('object/authenticated/' + EVIDENCE_BUCKET + '/' + this.path(key));
    return r.status === 404 ? null : {body: r.body};
  }
  async delete(key) {
    this.path(key);
    const r = await this.send('object/' + EVIDENCE_BUCKET, {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prefixes: [key]})});
    await r.arrayBuffer();
  }
  async list({prefix = '', limit = 100, cursor = ''} = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid list limit');
    let after = '';
    if (cursor) {const p = JSON.parse(atob(cursor)); if (p.prefix !== prefix || typeof p.after !== 'string') throw new Error('Invalid object cursor'); after = p.after;}
    // Keyset pagination remains valid when the preceding page is deleted.
    // Read storage metadata only; all object writes go through the Storage API.
    const {results} = await this.DB.prepare('SELECT name,metadata FROM storage.objects WHERE bucket_id=? AND starts_with(name,?) AND name>? ORDER BY name LIMIT ?').bind(EVIDENCE_BUCKET, prefix, after, limit + 1).all();
    const objects = results.slice(0, limit).map(r => ({key: r.name, size: Number(r.metadata?.size || 0)}));
    const truncated = results.length > limit;
    return {objects, truncated, ...(truncated ? {cursor: btoa(JSON.stringify({prefix, after: objects.at(-1).key}))} : {})};
  }
}
