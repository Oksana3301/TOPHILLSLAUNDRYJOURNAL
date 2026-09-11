import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {proxySupabase} from '../server/supabase-proxy.mjs';
import {backendRequest} from '../server/supabase-gateway.mjs';
import {migrationExport} from '../server/migration-export.mjs';
import {SupabaseStorage} from '../server/supabase-storage.mjs';
import {PostgresDatabase} from '../server/postgres-db.mjs';

const origin = 'https://local.test', token = 'a'.repeat(64), key = 'b'.repeat(64);
const config = {origin, tokenHash: createHash('sha256').update(token).digest('hex')};
test('Live PostgreSQL and Site proxy modes close practice pages and practice writes', async () => {
  const {default: worker} = await import('../dist/server/index.js');
  for (const DATA_BACKEND of ['supabase', 'postgres']) {
    for (const path of ['/demo', '/demo.html', '/sop-demo.html', '/api/laundry-demo/start']) {
      const response = await worker.fetch(new Request(origin + path), {DATA_BACKEND});
      assert.equal(response.status, 404);
    }
  }
});
test('Gateway denies untrusted callers before exposing identity or data', async () => {
  for (const authorization of ['', 'Bearer ' + 'c'.repeat(64)]) {
    assert.equal(await backendRequest(new Request(origin, {headers: {Authorization: authorization, 'oai-authenticated-user-id': 'owner'}}), config), null);
  }
});
test('Proxy restores customer auth and CSRF origin only inside an authenticated backend request', async t => {
  let incoming;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    incoming = await backendRequest(new Request(url, options), config);
    return new Response('ok', {headers: {'X-Top-Hills-Session-Key': key, 'Set-Cookie': '__Host-th-session=test; Secure; HttpOnly'}});
  });
  const req = new Request(origin + '/api/portal/approve', {method: 'POST', headers: {Authorization: 'Bearer customer-capability', Origin: origin, 'X-Top-Hills': '1', 'X-Top-Hills-Internal': 'scheduled'}, body: '{}'});
  const env = {SUPABASE_URL: 'https://' + 'a'.repeat(20) + '.supabase.co', SUPABASE_BACKEND_TOKEN: token, AUTH_SESSION_KEY: key};
  const response = await proxySupabase(req, env);
  assert.equal(response.status, 200);
  assert.equal(incoming.request.url, req.url);
  assert.equal(incoming.request.headers.get('Authorization'), 'Bearer customer-capability');
  assert.equal(incoming.request.headers.get('X-Top-Hills'), '1');
  assert.equal(incoming.request.headers.get('Origin'), origin);
  assert.equal(incoming.internal, false);
  assert.equal(incoming.request.headers.get('X-Top-Hills-Session-Key'), null);
  assert.equal(response.headers.get('X-Top-Hills-Session-Key'), null);
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly/);
  assert.equal((await proxySupabase(new Request(origin + '/api/__backend/scheduled'), env)).status, 404);
});
test('Migration export is disabled, authenticated, expiring, and keeps full row data', async () => {
  const data = JSON.stringify({large: 'x'.repeat(100000)}), rows = [{id: 'main', data}];
  const env = {TOP_HILLS_MIGRATION_MODE: 'export', TOP_HILLS_MIGRATION_TOKEN: token, TOP_HILLS_MIGRATION_EXPIRES: new Date(Date.now() + 60000).toISOString(), DB: {prepare(q) {assert.equal(q, 'SELECT * FROM workspace WHERE id>? ORDER BY id LIMIT 26'); return {bind() {return {all: async () => ({results: rows})};}};}}};
  const req = new Request(origin + '/api/maintenance/export?table=workspace', {headers: {'X-Top-Hills-Migration': token}});
  assert.equal((await migrationExport(req, {})).status, 403);
  assert.equal((await migrationExport(new Request(req.url), env)).status, 403);
  assert.equal((await migrationExport(req, {...env, TOP_HILLS_MIGRATION_EXPIRES: '2020-01-01'})).status, 403);
  assert.equal((await (await migrationExport(req, env)).json()).rows[0].data, data);
  assert.equal((await migrationExport(new Request(origin + '/api/maintenance/export?table=auth.users', {headers: req.headers}), env)).status, 400);
});
test('Storage keeps objects private, validates keys and uses deletion-stable pagination', async () => {
  const seen = [], names = ['proof/a', 'proof/b', 'proof/c'];
  const DB = {prepare() {return {bind(bucket, prefix, after, limit) {return {all: async () => ({results: names.filter(n => n.startsWith(prefix) && n > after).slice(0, limit).map(name => ({name, metadata: {size: 3}}))})};}};}};
  const store = new SupabaseStorage({url: 'https://' + 'a'.repeat(20) + '.supabase.co', key: 'sb_secret_fictional_test', DB, request: async (url, options) => {seen.push({url, options}); return new Response('bytes');}});
  await store.get('proof/a');
  assert.match(seen[0].url, /object\/authenticated\/top-hills-evidence\/proof\/a$/);
  assert.equal(seen[0].options.headers.get('Authorization'), null);
  assert.equal(seen[0].options.headers.get('apikey'), 'sb_secret_fictional_test');
  await assert.rejects(store.get('../private'));
  const one = await store.list({prefix: 'proof/', limit: 2});
  names.splice(0, 2);
  assert.deepEqual((await store.list({prefix: 'proof/', limit: 2, cursor: one.cursor})).objects.map(o => o.key), ['proof/c']);
});
test('Failed PostgreSQL batch rolls back its state and audit writes together', async () => {
  const {PGlite} = await import('@electric-sql/pglite'), pg = new PGlite();
  try {
    await pg.exec('CREATE TABLE sample(id text primary key, revision bigint); INSERT INTO sample VALUES (\'main\',0)');
    const DB = new PostgresDatabase(fn => pg.transaction(tx => fn({query: (q,p) => tx.query(q,p)})));
    await assert.rejects(DB.batch([DB.prepare('UPDATE sample SET revision=1 WHERE id=?').bind('main'), DB.prepare('INSERT INTO sample VALUES(?,?)').bind('main', 2)]));
    assert.equal(Number((await pg.query('SELECT revision FROM sample')).rows[0].revision), 0);
  } finally {await pg.close();}
});
