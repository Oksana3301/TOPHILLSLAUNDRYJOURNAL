import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdtemp, mkdir, cp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Script} from 'node:vm';
import {handleVercelApi} from '../server/vercel-api.mjs';
import {proxySupabase} from '../server/supabase-proxy.mjs';
import {backendRequest} from '../server/supabase-gateway.mjs';
import {createTestDatabase} from './database-fixture.mjs';

const origin = 'https://tophillslaundryjournal.vercel.app', sites = 'https://sites.example.test';
const token = 'a'.repeat(64), sessionKey = 'b'.repeat(64), oldToken = 'c'.repeat(64);
const sha = text => createHash('sha256').update(text).digest('hex');
const env = {TOP_HILLS_SITE_ORIGIN: origin, SUPABASE_URL: 'https://dkiqgwziefazwrcieavq.supabase.co',
  SUPABASE_BACKEND_TOKEN: token, AUTH_SESSION_KEY: sessionKey, VERCEL_ENV: 'production'};
const gateway = {origin: sites, tokenHash: sha(oldToken),
  clients: [{origin, tokenHash: sha(token), sessionKeyHash: sha(sessionKey)}]};
function request(endpoint, value, extra = {}) {
  const headers = {'X-Top-Hills': '1', Origin: origin, ...extra};
  if (value !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(origin + '/api/bridge?__th_path=' + endpoint, {
    method: value === undefined ? 'GET' : 'POST', headers,
    body: value === undefined ? undefined : JSON.stringify(value)
  });
}
function transport(sourceOrigin, credential, key, extra = {}) {
  return new Request(env.SUPABASE_URL + '/functions/v1/tophills-api', {headers: {
    Authorization: 'Bearer ' + credential, 'X-Top-Hills-Source-Origin': sourceOrigin,
    'X-Top-Hills-Source-Path': '/api/state', 'X-Top-Hills-Session-Key': key,
    'oai-authenticated-user-id': 'forged-owner', ...extra
  }});
}
test('Missing configuration and preview deployments never contact the production backend', async () => {
  const never = async () => {throw new Error('Backend must not be contacted');};
  for (const settings of [{}, {...env, VERCEL_ENV: 'preview'}]) {
    const r = await handleVercelApi(request('auth/config'), settings, never);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).enabled, false);
    assert.equal((await handleVercelApi(request('state'), settings, never)).status, 503);
  }
});
test('Cross-origin writes and private/traversal routes are rejected before proxying', async () => {
  let calls = 0;
  const proxy = async () => {calls++;return Response.json({});};
  assert.equal((await handleVercelApi(request('transactions', {}, {Origin: 'https://evil.test'}), env, proxy)).status, 403);
  for (const route of ['__backend/health', 'maintenance/export', 'laundry-demo/start', '../state', 'state&__th_path=auth/config']) {
    const r = await handleVercelApi(request(route), env, proxy);
    assert([400,404].includes(r.status), route);
  }
  assert.equal(calls, 0);
});
test('Adapter forwards customer auth and its cookie, strips forged identity and internal headers', async () => {
  let captured;
  const r = await handleVercelApi(request('portal/order?ignored', undefined), env);
  assert.equal(r.status, 404);
  const response = await handleVercelApi(request('portal/approve', {revision: 1}, {
    Authorization: 'Bearer customer-capability', Cookie: '__Host-th-session=' + 'e'.repeat(64) + '; unrelated=private',
    'oai-authenticated-user-id': 'owner', 'X-Top-Hills-Internal': 'scheduled',
    'X-Top-Hills-Source-Origin': sites, 'CF-Connecting-IP': '198.51.100.9',
    'x-vercel-forwarded-for': '203.0.113.4'
  }), env, async req => {captured = req;return Response.json({saved: true});});
  assert.equal(response.status, 200);
  assert.equal(captured.url, origin + '/api/portal/approve');
  assert.equal(captured.headers.get('Authorization'), 'Bearer customer-capability');
  assert.equal(captured.headers.get('oai-authenticated-user-id'), null);
  assert.equal(captured.headers.get('X-Top-Hills-Internal'), null);
  assert.equal(captured.headers.get('X-Top-Hills-Source-Origin'), null);
  assert.equal(captured.headers.get('CF-Connecting-IP'), '203.0.113.4');
  assert(!captured.headers.get('Cookie').includes('unrelated'));
  assert.deepEqual(await captured.json(), {revision: 1});
});
test('Gateway preserves Sites identity but binds Vercel token and session key to its own origin', async () => {
  const previous = await backendRequest(transport(sites, oldToken, 'd'.repeat(64)), gateway);
  assert.equal(previous.request.headers.get('oai-authenticated-user-id'), 'forged-owner');
  const vercel = await backendRequest(transport(origin, token, sessionKey, {'X-Top-Hills-Internal': 'scheduled'}), gateway);
  assert.equal(vercel.request.headers.get('oai-authenticated-user-id'), null);
  assert.equal(vercel.internal, false);
  assert.equal(vercel.sessionKey, sessionKey);
  for (const args of [[sites,token,sessionKey],[origin,oldToken,sessionKey],[origin,token,'d'.repeat(64)],['https://evil.test',token,sessionKey]]) {
    assert.equal(await backendRequest(transport(...args), gateway), null);
  }
  assert.equal(await backendRequest(transport(origin, token, sessionKey), {...gateway, clients: []}), null);
});
test('Cookies and upstream failures survive the proxy without leaking internal credentials', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const restored = await backendRequest(new Request(url, options), gateway);
    assert(restored);
    assert.equal(restored.request.headers.get('oai-authenticated-user-id'), null);
    return Response.json({error:'Sesi berakhir'}, {status:401,headers:{
      'Set-Cookie':'__Host-th-session=; Secure; HttpOnly; Path=/; Max-Age=0',
      'X-Top-Hills-Session-Key':sessionKey,Authorization:token
    }});
  });
  const r = await handleVercelApi(request('state'), env);
  assert.equal(r.status, 401);
  assert.match(r.headers.get('Set-Cookie'), /HttpOnly/);
  assert.equal(r.headers.get('Authorization'), null);
  assert.equal(r.headers.get('X-Top-Hills-Session-Key'), null);
  assert(!JSON.stringify(await r.json()).includes(token));
});
test('Body limit rejects oversized writes before any transaction reaches Supabase', async () => {
  let called = false;
  const req = new Request(origin+'/api/bridge?__th_path=proof', {
    method:'POST',headers:{Origin:origin,'X-Top-Hills':'1'},body:new Uint8Array(4250001)
  });
  const r = await handleVercelApi(req, env, async () => {called=true;return Response.json({});});
  assert.equal(r.status,413);assert.equal(called,false);
});
test('Real session and transaction handlers work through the Vercel adapter on an isolated database', async t => {
  const {DB,sql,close} = await createTestDatabase();
  const {default:worker} = await import('../dist/server/index.js');
  const apiEnv = {DB,BUCKET:{},DATA_BACKEND:'postgres',ALLOW_INITIAL_OWNER:'1',
    SUPABASE_URL:env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',AUTH_SESSION_KEY:sessionKey};
  const user={id:'vercel-fake-owner',email:'owner@example.test',email_confirmed_at:'2026-09-11',
    user_metadata:{full_name:'Fictional Owner'}};
  try {
    await sql.prepare('INSERT INTO members(id,name,email,role,status,profile,created_at) VALUES(?,?,?,?,?,?,?)')
      .run('sb:'+user.id,'Fictional Owner',user.email,'Owner','Aktif','{}',new Date().toISOString());
    t.mock.method(globalThis,'fetch',async (url,options) => {
      if (String(url).includes('/functions/v1/tophills-api')) {
        const restored=await backendRequest(new Request(url,options),gateway);
        if(!restored)return Response.json({error:'Unauthorized'},{status:401});
        return worker.fetch(restored.request,{...apiEnv,AUTH_SESSION_KEY:restored.sessionKey});
      }
      assert(String(url).includes('/auth/v1/token'));
      return Response.json({user,access_token:'fictional-provider-access',refresh_token:'fictional-provider-refresh',expires_in:3600});
    });
    const anonymous=await handleVercelApi(request('state',undefined,{'oai-authenticated-user-id':'sb:'+user.id}),env);
    assert.equal(anonymous.status,401);
    const login=await handleVercelApi(request('auth/login',{email:user.email,password:'fictional-password-123'}),env);
    assert.equal(login.status,200,await login.clone().text());
    const cookie=login.headers.get('Set-Cookie').split(';')[0];
    assert.match(login.headers.get('Set-Cookie'),/HttpOnly/);
    assert(!(await login.text()).includes('fictional-provider-access'));
    const response=await handleVercelApi(request('state',undefined,{Cookie:cookie}),env);
    assert.equal(response.status,200,await response.clone().text());
    const state=await response.json();
    assert.equal(state.member.role,'Owner');
    const payload={revision:state.revision,mutationId:'vercel-test-transaction',
      transaction:{kind:'expense',date:'2026-09-10',unit:'laundry',description:'Biaya fiktif adapter',amount:1000,
        account:'6103',vendor:'Vendor Fiktif',invoiceNo:'VERCEL-TEST-1',paid:true,cashAccount:'1102'}};
    const save=await handleVercelApi(request('transactions',payload,{Cookie:cookie}),env);
    assert.equal(save.status,200,await save.clone().text());
    const saved=await save.json();
    const retry=await handleVercelApi(request('transactions',payload,{Cookie:cookie}),env);
    assert.equal(retry.status,200,await retry.clone().text());
    assert.equal((await retry.json()).objectId,saved.objectId);
    const logOut=await handleVercelApi(request('auth/logout',{}, {Cookie:cookie}),env);
    assert.equal(logOut.status,200);
    assert.equal((await handleVercelApi(request('state',undefined,{Cookie:cookie}),env)).status,401);
  } finally {await close();}
});
test('Browser scripts parse and packaged frontend hides unsupported ChatGPT login', async () => {
  for(const file of ['staff-login.js','upload.js','portal.js','cloud.js'])new Script(await readFile('dist/'+file,'utf8'));
  const html=await readFile('vercel-public/staff-login.html','utf8');
  assert(html.indexOf('/host-config.js')<html.indexOf('/staff-login.js'));
  assert.match(await readFile('vercel-public/host-config.js','utf8'),/chatgptLogin: false/);
  await assert.rejects(stat('vercel-public/server'));
  await assert.rejects(stat('vercel-public/.openai'));
});
test('Local provisioning is idempotent and prints only fingerprints, never secrets', async () => {
  const dir=await mkdtemp(path.join(tmpdir(),'tophills-setup-'));
  try {
    await mkdir(path.join(dir,'scripts'));
    const script=path.join(dir,'scripts/setup-vercel.mjs');
    await cp('scripts/setup-vercel.mjs',script);
    const first=execFileSync(process.execPath,[script],{encoding:'utf8'});
    const content=await readFile(path.join(dir,'.env.vercel.local'),'utf8');
    const secrets=content.trim().split('\n').filter(s=>/TOKEN=|KEY=/.test(s)).map(s=>s.split('=')[1]);
    for(const secret of secrets){assert.equal(secret.length,64);assert(!first.includes(secret));assert(first.includes(sha(secret)));}
    assert.equal(execFileSync(process.execPath,[script],{encoding:'utf8'}),first);
    assert.equal(await readFile(path.join(dir,'.env.vercel.local'),'utf8'),content);
    assert.equal((await stat(path.join(dir,'.env.vercel.local'))).mode&0o777,0o600);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('Configuration diagnostics identify missing or invalid settings without exposing values', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const invalid = {...env, SUPABASE_URL: 'private-invalid-url',
    SUPABASE_BACKEND_TOKEN: 'private-invalid-token', AUTH_SESSION_KEY: ''};
  const response = await handleVercelApi(request('auth/config'), invalid,
    async () => {throw new Error('Unconfigured request must not reach backend');});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.enabled, false);
  assert.equal(logs.length, 1);
  assert.deepEqual(JSON.parse(logs[0][1]), {
    TOP_HILLS_SITE_ORIGIN: 'ready',
    SUPABASE_BACKEND_TOKEN: 'invalid', AUTH_SESSION_KEY: 'missing', production: true
  });
  const output = JSON.stringify({logs, body});
  for (const value of [invalid.SUPABASE_URL, invalid.SUPABASE_BACKEND_TOKEN, env.SUPABASE_BACKEND_TOKEN]) {
    assert(!output.includes(value));
  }
  assert(!JSON.stringify(body).includes('TOP_HILLS_SITE_ORIGIN'));
});

test('Vercel always uses the verified Top Hills project even when the host setting is missing or wrong', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://dkiqgwziefazwrcieavq.supabase.co/functions/v1/tophills-api');
    assert.equal(options.headers.get('Authorization'), 'Bearer ' + token);
    assert.equal(options.headers.get('X-Top-Hills-Session-Key'), sessionKey);
    assert.equal(options.headers.get('X-Top-Hills-Source-Origin'), origin);
    return Response.json({enabled: true});
  });
  for (const SUPABASE_URL of [undefined, 'malformed-url', 'https://wrong-project.example.test', env.SUPABASE_URL + '/']) {
    const response = await handleVercelApi(request('auth/config'), {...env, SUPABASE_URL});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).enabled, true);
  }
  assert.equal(calls, 4);
  for (const settings of [{...env, SUPABASE_BACKEND_TOKEN: ''}, {...env, AUTH_SESSION_KEY: ''},
    {...env, VERCEL_ENV: 'preview'}]) {
    const response = await handleVercelApi(request('state'), settings);
    assert.equal(response.status, 503);
  }
  assert.equal(calls, 4, 'Missing credentials and preview must not reach the backend');
});
