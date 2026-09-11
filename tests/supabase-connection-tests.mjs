import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPECTED_TABLES, inspectConnection} from '../scripts/check-supabase.mjs';

const project = {projectRef: 'abcdefghijklmnopqrst', apiUrl: 'https://abcdefghijklmnopqrst.supabase.co'};
const env = {SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_test_only', SUPABASE_SECRET_KEY: 'sb_secret_fake_test_only'};
const json = (value, status = 200) => new Response(JSON.stringify(value), {status});

test('diagnostic table coverage follows the complete application schema', async () => {
  const source = await readFile(new URL('../db/schema.ts', import.meta.url), 'utf8');
  const tables = [...source.matchAll(/sqliteTable\('([^']+)'/g)].map(m => m[1]);
  assert.deepEqual([...EXPECTED_TABLES].sort(), tables.sort());
});
function mockRequest({tables = EXPECTED_TABLES, calls = []} = {}) {
  return async (url, options) => {
    calls.push({url, options});
    const path = new URL(url).pathname;
    if (path === '/auth/v1/settings') return json({external: {email: true}, disable_signup: false, mailer_autoconfirm: false});
    if (path === '/rest/v1/') return json({paths: Object.fromEntries(tables.map(t => ['/' + t, {}]))});
    if (path === '/storage/v1/bucket') return json([{id: 'private-proofs', name: 'private-proofs', public: false}]);
    return tables.includes(path.split('/').at(-1)) ? json([]) : json({code: 'PGRST205'}, 404);
  };
}

test('checks all tables without reading rows, redirecting credentials, or claiming a completed migration', async () => {
  const calls = [];
  const result = await inspectConnection({project, env, request: mockRequest({calls})});
  assert.equal(result.connectivityVerified, true);
  assert.equal(result.expectedTablesAccessible, true);
  assert.equal(result.migrationVerified, false);
  assert.equal(result.operationalReady, false);
  assert.equal(calls.length, 3 + EXPECTED_TABLES.length);
  for (const {url, options} of calls) {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(new URL(url).origin, project.apiUrl);
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.apikey, url.includes('/auth/') ? env.SUPABASE_PUBLISHABLE_KEY : env.SUPABASE_SECRET_KEY);
    if (new URL(url).pathname !== '/rest/v1/' && url.includes('/rest/')) {
      assert.equal(new URL(url).searchParams.get('limit'), '0');
      assert.equal(options.headers.Prefer, undefined);
    }
  }
  assert.equal(JSON.stringify(result).includes(env.SUPABASE_SECRET_KEY), false);
});

test('empty schema is a successful connection with inaccessible application tables', async () => {
  const result = await inspectConnection({project, env, request: mockRequest({tables: []})});
  assert.equal(result.connectivityVerified, true);
  assert.equal(result.expectedTablesAccessible, false);
  assert.equal(result.observed.dataApi.tableProbes.length, 18);
  assert.ok(result.observed.dataApi.tableProbes.every(t => !t.ok && t.errorCode === 'PGRST205'));
});

test('blocks CI and a different target project before sending credentials', async () => {
  const request = () => assert.fail('No network request is allowed');
  await assert.rejects(inspectConnection({project, env: {...env, CI: 'true'}, request}), /disabled in CI/);
  await assert.rejects(inspectConnection({project, env: {...env, SUPABASE_URL: 'https://other.supabase.co'}, request}), /does not match/);
  await assert.rejects(inspectConnection({project: {...project, apiUrl: 'https://example.com'}, env, request}), /Invalid Supabase/);
  await assert.rejects(inspectConnection({project, env: {}, request}), /Set SUPABASE/);
});

test('auth failures are errors, not an empty database, and skip table probes', async () => {
  let calls = 0;
  const result = await inspectConnection({project, env, request: async () => {
    calls++; return json({code: 'invalid_api_key', message: env.SUPABASE_SECRET_KEY}, 401);
  }});
  assert.equal(result.connectivityVerified, false);
  assert.equal(calls, 3);
  assert.equal(result.observed.dataApi.visibleTablesOrViews, undefined);
  assert.equal(JSON.stringify(result).includes(env.SUPABASE_SECRET_KEY), false);
});

test('does not echo secrets from API fields or exception messages', async () => {
  const normal = mockRequest();
  const result = await inspectConnection({project, env, request: async (url, options) => {
    if (url.includes('/auth/')) throw new Error(env.SUPABASE_SECRET_KEY);
    if (url.endsWith('/rest/v1/')) return json({paths: {['/' + env.SUPABASE_SECRET_KEY]: {}}});
    if (url.includes('/storage/')) return json([{id: env.SUPABASE_SECRET_KEY, name: env.SUPABASE_PUBLISHABLE_KEY}]);
    return normal(url, options);
  }});
  assert.equal(result.connectivityVerified, false);
  assert.equal(JSON.stringify(result).includes(env.SUPABASE_SECRET_KEY), false);
  assert.equal(JSON.stringify(result).includes(env.SUPABASE_PUBLISHABLE_KEY), false);
});

test('rejects malformed successful API responses', async () => {
  const result = await inspectConnection({project, env, request: async () => json({})});
  assert.equal(result.connectivityVerified, false);
  assert.equal(result.observed.dataApi.visibleTablesOrViews, undefined);
  assert.equal(result.observed.storage.buckets, undefined);
});

test('permission-denied tables remain distinct from absent tables', async () => {
  const normal = mockRequest();
  const result = await inspectConnection({project, env, request: async (url, options) => {
    if (url.includes('/rest/v1/members?')) return json({code: '42501'}, 403);
    return normal(url, options);
  }});
  assert.equal(result.connectivityVerified, true);
  assert.equal(result.expectedTablesAccessible, false);
  assert.equal(result.observed.dataApi.tableProbes.find(t => t.table === 'members').errorCode, '42501');
});
