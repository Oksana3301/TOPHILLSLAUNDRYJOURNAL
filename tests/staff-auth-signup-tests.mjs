import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './database-fixture.mjs';
import {staffAuthRoute, authErrorResponse, resolveStaffIdentity} from '../server/staff-auth.mjs';

const credentials={email:'owner-request@example.test',password:'Fictional-password-725!',name:'Owner Request Fixture',role:'Owner'};
const verified={id:'owner-request-fixture',email:credentials.email,email_confirmed_at:'2026-09-11T00:00:00Z',user_metadata:{full_name:credentials.name,requested_role:'Owner'}};
const tokens={user:verified,access_token:'fixture-access-never-public',refresh_token:'fixture-refresh-never-public',expires_in:3600};
async function fixture(t){
  const database=await createTestDatabase();t.after(database.close);
  return {...database,env:{DB:database.DB,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',AUTH_SESSION_KEY:'a'.repeat(64)}};
}
function request(path,payload,device=1,cookie=''){
  return new Request('https://local.test/api/auth/'+path,{method:payload?'POST':'GET',headers:{Origin:'https://local.test','X-Top-Hills':'1','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.'+device,'User-Agent':'Fresh fixture device '+device,Cookie:cookie},body:payload?JSON.stringify(payload):undefined});
}
async function call(f,path,payload,device=1,cookie=''){
  let response;
  try{response=await staffAuthRoute(request(path,payload,device,cookie),f.env);}
  catch(error){response=authErrorResponse(error);if(!response)throw error;}
  return {status:response.status,body:await response.json(),headers:response.headers};
}
const total=async(f,table)=>(await f.DB.prepare('SELECT count(*) AS total FROM '+table).first()).total;

test('Provider email quota affects independent fresh devices without creating an Owner or session',async t=>{
  const f=await fixture(t);
  let count=0;t.mock.method(globalThis,'fetch',async()=>Response.json(count++?{code:429,error_code:'over_email_send_rate_limit'}:{code:'over_email_send_rate_limit'},{status:429,headers:{'Retry-After':'120'}}));
  for(const device of [1,2]){
    const r=await call(f,'signup',{...credentials,email:`owner-${device}@example.test`},device);
    assert.equal(r.status,429);assert.equal(r.body.code,'over_email_send_rate_limit');
    assert.match(r.body.error,/Mengganti perangkat/);assert.equal(r.body.retryAfter,120);
    assert.equal(r.headers.get('Retry-After'),'120');
  }
  assert.equal(await total(f,'members'),0);assert.equal(await total(f,'staff_sessions'),0);
  assert.equal((await f.DB.prepare('SELECT max(count) AS maximum FROM auth_limits').first()).maximum,1);
});

test('Signup sends a trusted return URL and requested Owner role, then waits for email confirmation',async t=>{
  const f=await fixture(t);let captured;
  t.mock.method(globalThis,'fetch',async(url,options)=>{captured={url:new URL(url),data:JSON.parse(options.body)};return Response.json({user:{...verified,email_confirmed_at:null}});});
  const r=await call(f,'signup',credentials);
  assert.equal(r.status,200);assert.equal(r.body.next,'confirm');assert.match(r.body.message,/tautannya/);
  assert.equal(captured.url.searchParams.get('redirect_to'),'https://local.test/login');
  assert.equal(captured.data.data.requested_role,'Owner');
  assert.equal(await total(f,'members'),0);assert.equal(await total(f,'staff_sessions'),0);
});

test('A provider-verified signup starts a pending account, never grants requested Owner, and works on a second device',async t=>{
  const f=await fixture(t);t.mock.method(globalThis,'fetch',async()=>Response.json(tokens));
  const first=await call(f,'signup',credentials,1),second=await call(f,'login',credentials,2);
  assert.equal(first.status,200);assert.equal(first.body.redirect,'/');assert.equal(second.status,200);
  const a=first.headers.get('Set-Cookie').split(';')[0],b=second.headers.get('Set-Cookie').split(';')[0];
  assert.notEqual(a,b);
  for(const [device,cookie] of [[1,a],[2,b]])assert.equal((await resolveStaffIdentity(request('sessions',null,device,cookie),f.env)).id,'sb:'+verified.id);
  const member=await f.DB.prepare('SELECT * FROM members').first();
  assert.equal(member.role,'Operator');assert.equal(member.status,'Menunggu');assert.equal(JSON.parse(member.profile).requestedRole,'Owner');
  assert.equal(await total(f,'members'),1);assert.equal(await total(f,'staff_sessions'),2);
  assert(!JSON.stringify(first.body).includes(tokens.access_token));assert(!JSON.stringify(second.body).includes(tokens.refresh_token));
});

test('Unconfirmed signup cannot create a local session even if the provider includes tokens',async t=>{
  const f=await fixture(t);t.mock.method(globalThis,'fetch',async()=>Response.json({...tokens,user:{...verified,email_confirmed_at:null}}));
  const r=await call(f,'signup',credentials);assert.equal(r.body.next,'confirm');
  assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(await total(f,'staff_sessions'),0);
});

test('Email setup, password and existing-account errors keep their actionable meaning',async t=>{
  const f=await fixture(t);let providerCode;
  t.mock.method(globalThis,'fetch',async()=>Response.json({code:422,error_code:providerCode,msg:'Raw provider message must stay private'},{status:422}));
  for(const [code,status,phrase] of [['email_address_not_authorized',503,/layanan email/i],['signup_disabled',503,/ditutup/],['weak_password',400,/Kata sandi/],['user_already_exists',409,/Pilih Masuk/],['email_not_confirmed',401,/belum dikonfirmasi/]]){
    providerCode=code;const r=await call(f,'signup',credentials);
    assert.equal(r.status,status);assert.equal(r.body.code,code);assert.match(r.body.error,phrase);
    assert(!JSON.stringify(r.body).includes('Raw provider'));
  }
});

test('Provider-wide request throttling is distinguished from the application email limit',async t=>{
  const f=await fixture(t);t.mock.method(globalThis,'fetch',async()=>Response.json({code:'over_request_rate_limit'},{status:429}));
  const r=await call(f,'signup',credentials);assert.equal(r.body.code,'over_request_rate_limit');
  assert.equal(r.headers.get('Retry-After'),null);assert(!r.body.error.includes('10 menit'));
});

test('Changing devices does not bypass the existing per-email safety limit',async t=>{
  const f=await fixture(t);let providerCalls=0;
  t.mock.method(globalThis,'fetch',async()=>{providerCalls++;return Response.json({user:{...verified,email_confirmed_at:null}});});
  let r;for(let device=1;device<=9;device++)r=await call(f,'signup',credentials,device);
  assert.equal(providerCalls,8);assert.equal(r.status,429);assert.equal(r.body.code,'auth_attempts_limited');
  assert(r.body.retryAfter>=1&&r.body.retryAfter<=600);
});

test('Unknown provider payloads cannot expose addresses, credentials or arbitrary error text',async t=>{
  const f=await fixture(t);
  t.mock.method(globalThis,'fetch',async()=>Response.json({code:'private@example.test',message:'secret-provider-key-and-password'},{status:500,headers:{'Retry-After':'not-a-duration'}}));
  const r=await call(f,'signup',credentials);
  assert.equal(r.status,503);assert.equal(r.body.code,'auth_provider_error');assert.equal(r.headers.get('Retry-After'),null);
  assert(!JSON.stringify(r.body).includes('private@'));assert(!JSON.stringify(r.body).includes('secret-provider'));
});

test('An existing Owner approves a new Owner and that approved account keeps its role on another device',async t=>{
  const f=await fixture(t),{default:worker}=await import('../dist/server/index.js');
  const env={...f.env,BUCKET:{},ALLOW_INITIAL_OWNER:'1'};
  t.mock.method(globalThis,'fetch',async()=>Response.json(tokens));
  async function business(path,{cookie='',owner=false,data}={}){
    const headers={Origin:'https://local.test','X-Top-Hills':'1','Content-Type':'application/json',Cookie:cookie};
    // Trusted platform identity is a fixture here, never a browser-provided production header.
    if(owner)headers['oai-authenticated-user-id']='original-owner-fixture';
    const r=await worker.fetch(new Request('https://local.test/api/'+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined}),env);
    return {status:r.status,body:await r.json()};
  }
  const initial=await business('state',{owner:true});assert.equal(initial.status,200);
  const registered=await call(f,'signup',credentials),cookie=registered.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await business('sync',{cookie})).status,403);
  const grant={id:'sb:'+verified.id,role:'Owner',status:'Aktif',employeeId:'',customerId:'',revision:initial.body.revision,mutationId:'owner-approval-fixture'};
  assert.equal((await business('member',{cookie,data:grant})).status,403);
  const approved=await business('member',{owner:true,data:grant});assert.equal(approved.status,200,JSON.stringify(approved.body));
  assert.equal((await business('sync',{cookie})).body.member.role,'Owner');
  const second=await call(f,'login',credentials,2),secondCookie=second.headers.get('Set-Cookie').split(';')[0];
  const secondState=await business('sync',{cookie:secondCookie});assert.equal(secondState.status,200);assert.equal(secondState.body.member.role,'Owner');
  assert.equal((await f.DB.prepare('SELECT role FROM members WHERE id=?').bind('original-owner-fixture').first()).role,'Owner');
});

test('Resend uses existing signup confirmation without creating a session or assigning a role',async t=>{
 const f=await fixture(t);let captured;t.mock.method(globalThis,'fetch',async(url,options)=>{captured={url:new URL(url),body:JSON.parse(options.body)};return Response.json({});});
 const r=await call(f,'resend',{email:credentials.email});assert.equal(r.status,200);assert.equal(r.body.next,'confirm');assert.equal(r.body.retryAfter,60);assert.equal(captured.url.pathname,'/auth/v1/resend');assert.equal(captured.url.searchParams.get('redirect_to'),'https://local.test/login');assert.equal(captured.body.type,'signup');assert(!captured.body.password);assert.equal(await total(f,'staff_sessions'),0);assert.equal(await total(f,'members'),0);
});
test('Signup attempts do not exhaust login or email-code verification allowance',async t=>{
 const f=await fixture(t);t.mock.method(globalThis,'fetch',async url=>Response.json(String(url).includes('/signup')?{user:{...verified,email_confirmed_at:null}}:tokens));
 for(let i=0;i<8;i++)assert.equal((await call(f,'signup',credentials)).status,200);
 assert.equal((await call(f,'signup',credentials)).status,429);assert.equal((await call(f,'confirm',{email:credentials.email,code:'123456'})).status,200);assert.equal((await call(f,'login',credentials)).status,200);
});
test('Invalid form fields do not consume valid registration attempts',async t=>{
 const f=await fixture(t);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({user:{...verified,email_confirmed_at:null}});});
 for(let i=0;i<9;i++)assert.equal((await call(f,'signup',{...credentials,password:'short'})).status,400);assert.equal(calls,0);assert.equal(await total(f,'auth_limits'),0);assert.equal((await call(f,'signup',credentials)).status,200);
});

const setupToken='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.fixture-signature';
const setupPassword={accessToken:setupToken,password:'New-fictional-password-725!',passwordConfirm:'New-fictional-password-725!'};
test('Invitation password setup verifies the provider identity, preserves Owner membership and revokes old app sessions',async t=>{
 const f=await fixture(t);
 t.mock.method(globalThis,'fetch',async()=>Response.json(tokens));
 const login=await call(f,'login',credentials),oldCookie=login.headers.get('Set-Cookie').split(';')[0];
 await f.DB.prepare("UPDATE members SET role='Owner',status='Aktif' WHERE id=?").bind('sb:'+verified.id).run();
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url,method:options.method,authorization:options.headers.Authorization,body:options.body?JSON.parse(options.body):null});
  return Response.json(verified);
 });
 const result=await call(f,'set-password',{...setupPassword,email:'attacker@example.test',role:'Owner',userId:'another-user'});
 assert.equal(result.status,200);assert.equal(result.body.next,'login');
 assert.equal(calls.length,2);assert.equal(calls[0].method,'GET');assert.equal(calls[1].method,'PUT');
 assert.equal(calls[0].url,'https://example.supabase.co/auth/v1/user');
 assert.equal(calls[0].authorization,'Bearer '+setupToken);assert.deepEqual(calls[1].body,{password:setupPassword.password});
 assert.equal((await f.DB.prepare('SELECT role FROM members WHERE id=?').bind('sb:'+verified.id).first()).role,'Owner');
 assert.equal((await f.DB.prepare('SELECT revoked FROM staff_sessions').first()).revoked,1);
 assert.equal((await f.DB.prepare('SELECT cipher FROM staff_sessions').first()).cipher,'');
 await assert.rejects(()=>resolveStaffIdentity(request('sessions',null,1,oldCookie),f.env),/Sesi berakhir/);
 assert.match(result.headers.get('Set-Cookie'),/Max-Age=0/);
 assert(!JSON.stringify(result.body).includes(setupToken));assert(!JSON.stringify(result.body).includes(setupPassword.password));
});
test('Password setup cannot create a member or grant a submitted Owner role',async t=>{
 const f=await fixture(t);t.mock.method(globalThis,'fetch',async()=>Response.json(verified));
 const result=await call(f,'set-password',{...setupPassword,role:'Owner',email:credentials.email});
 assert.equal(result.status,200);assert.equal(await total(f,'members'),0);assert.equal(await total(f,'staff_sessions'),0);
});
test('Expired, unconfirmed or mismatched invitation identities cannot complete password setup',async t=>{
 for(const variant of ['expired','unconfirmed','mismatched']){
  const f=await fixture(t);let count=0;
  t.mock.method(globalThis,'fetch',async()=>{
   count++;
   if(variant==='expired')return Response.json({code:'bad_jwt',message:'provider-private-token'}, {status:401});
   if(variant==='unconfirmed')return Response.json({...verified,email_confirmed_at:null});
   return Response.json(count===1?verified:{...verified,id:'different-user'});
  });
  const result=await call(f,'set-password',setupPassword);
  assert.equal(result.status,401,variant);assert.equal(count,variant==='mismatched'?2:1);
  assert.equal(await total(f,'members'),0);assert.equal(await total(f,'staff_sessions'),0);
  assert(!JSON.stringify(result.body).includes('provider-private-token'));
 }
});
test('Malformed tokens, mismatching passwords and cross-origin password setup are rejected before contacting the provider',async t=>{
 const f=await fixture(t);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(verified);});
 for(const payload of [{...setupPassword,accessToken:''},{...setupPassword,password:'short',passwordConfirm:'short'},
  {...setupPassword,passwordConfirm:'Different-password-123!'},{...setupPassword,accessToken:'x'.repeat(8193)}]){
  const result=await call(f,'set-password',payload);assert([400,401].includes(result.status));
 }
 const badOrigin=request('set-password',setupPassword);badOrigin.headers.set('Origin','https://evil.test');
 await assert.rejects(()=>staffAuthRoute(badOrigin,f.env),error=>error.status===403);
 assert.equal(calls,0);assert.equal(await total(f,'auth_limits'),0);
});
test('Password setup is rate limited before repeatedly checking a provider token',async t=>{
 const f=await fixture(t);let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'bad_jwt'},{status:401});});
 for(let i=0;i<8;i++)assert.equal((await call(f,'set-password',setupPassword)).status,401);
 const rejected=await call(f,'set-password',setupPassword);assert.equal(rejected.status,429);assert.equal(calls,8);
});
