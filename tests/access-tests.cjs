/* Tests local demo account lifecycle with real password derivation; no browser visual QA. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const TH=require('../dist/logic.js'),motion=require('../dist/motion.js');
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const docEvents={},winEvents={},storage=memory(),sessions=memory();let modal='',closed=0;
const ctx={console,crypto:webcrypto,TextEncoder,Uint8Array,Date,JSON,Number,String,Math,Promise,Set,FormData:class{constructor(f){return new Map(Object.entries(f.values))}},TH,TH_CONTENT:{edition:'Test',intro:'Test',heading:'Semua terurus, mulai dari sini.',scenes:[]},THMotion:motion,localStorage:storage,sessionStorage:sessions,location:{hash:''},navigator:{},ui:{role:'Owner',employee:'e1',consumer:'t1'},db:TH.seed(),app:{innerHTML:''},loadWarning:'',basketSrc:'basket.png',esc:v=>String(v??'').replaceAll('<','&lt;'),uid:p=>p+'-'+webcrypto.randomUUID(),icon:()=>'',initials:n=>n.slice(0,2),field:()=>'',select:()=>'',area:()=>'',check:()=>'',badge:()=>'',datetime:v=>v,download:()=>{},toast:()=>{},openModal:(t,b)=>{modal=b},closeModal:()=>{closed++},setTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}};
ctx.window=ctx;ctx.getEmp=id=>ctx.db.employees.find(e=>e.id===id)?.name||'Karyawan nonaktif';ctx.getTenant=id=>ctx.db.tenants.find(t=>t.id===id);ctx.addEventListener=(n,f)=>winEvents[n]=f;ctx.scrollTo=()=>{};ctx.document={body:{classList:{add(){},remove(){}}},querySelector:()=>null,addEventListener:(n,f)=>docEvents[n]=f};ctx.render=()=>{if(!ctx.THAccess.bind())ctx.THAccess.render()};vm.createContext(ctx);
let source=fs.readFileSync(require.resolve('../dist/access.js'),'utf8');source=source.replace('renderAccess();init();','globalThis.accessTest={submit,accessActions,ready:init()};');vm.runInContext(source,ctx);
const makeForm=(type,values,id)=>{const error={textContent:''},button={disabled:false};return {dataset:{accessForm:type,id},values,querySelector:s=>s==='[type=submit]'?button:error,error,button}};
const submit=async(type,values,id)=>{const f=makeForm(type,values,id);await ctx.accessTest.submit(f);return f.error.textContent};
const login=(email,password='TopHills!Demo26')=>submit('signin',{email,password});
const key='top-hills-demo-accounts-v1';
(async()=>{
 await ctx.accessTest.ready;
 assert.equal(ctx.THAccess.current(),null);assert.equal(JSON.parse(storage.getItem(key)).accounts.length,3);
 assert.match(await login('owner@tophills.example','wrong'),/belum cocok/);assert.equal(ctx.THAccess.current(),null);
 assert.equal(await login('owner@tophills.example'),'');assert.equal(ctx.THAccess.current().role,'Owner');ctx.accessTest.accessActions.signout();
 console.log('PASS Sign-in verifies demo password; signout ends session');
 const request={name:'Dita Demo',email:'dita@tophills.example',password:'DitaDemo123!',confirm:'DitaDemo123!',role:'Operator',demo:'on'};
 assert.match(await submit('signup',{...request,role:'Owner'}),/tidak bisa didaftarkan/);
 assert.match(await submit('signup',{...request,email:'person@gmail.com'}),/fiktif/);
 assert.match(await submit('signup',{...request,confirm:'Mismatch123!'}),/yang sama/);
 assert.equal(await submit('signup',request),'');assert.equal(ctx.THAccess.current(),null);
 assert.match(await login(request.email,request.password),/menunggu persetujuan/);
 assert.match(await submit('signup',request),/sudah terdaftar/);
 console.log('PASS Registration cannot grant Owner, use real email, duplicate, or bypass approval');
 const a=JSON.parse(storage.getItem(key)).accounts.find(a=>a.email===request.email);
 assert.match(await submit('approve',{profileId:'e2',name:request.name,reason:'Tinjau identitas demo',approved:'on'},a.id),/hanya tersedia untuk Owner/);
 await login('owner@tophills.example');
 assert.match(await submit('approve',{profileId:'e1',name:request.name,reason:'Tinjau identitas demo',approved:'on'},a.id),/sudah memiliki akun/);
 assert.equal(await submit('approve',{profileId:'e2',name:request.name,reason:'Tinjau identitas demo',approved:'on'},a.id),'');
 ctx.accessTest.accessActions.signout();assert.equal(await login(request.email,request.password),'');assert.equal(ctx.ui.role,'Operator');assert.equal(ctx.ui.employee,'e2');
 console.log('PASS Owner approval links one individual active employee account');
 ctx.accessTest.accessActions.signout();await login('owner@tophills.example');
 assert.equal(await submit('revoke',{reason:'Akses demo selesai'},a.id),'');ctx.accessTest.accessActions.signout();assert.match(await login(request.email,request.password),/dinonaktifkan/);assert(JSON.parse(storage.getItem(key)).accounts.some(x=>x.id===a.id));assert(JSON.parse(storage.getItem(key)).events.some(e=>e.text.includes('dinonaktifkan')));
 console.log('PASS Revocation prevents sign-in and retains account/audit history');
 await login('alya@tophills.example');assert.equal(ctx.ui.role,'Konsumen');assert.equal(ctx.ui.consumer,'t1');
 let s=JSON.parse(storage.getItem(key));s.accounts.find(a=>a.id==='demo-consumer').tenantId='t2';const previousClosed=closed;winEvents.storage({key,newValue:JSON.stringify(s)});assert.equal(ctx.ui.consumer,'t2');assert(closed>previousClosed);
 s.accounts.find(a=>a.id==='demo-consumer').status='Nonaktif';winEvents.storage({key,newValue:JSON.stringify(s)});assert.equal(ctx.THAccess.current(),null);
 console.log('PASS Active profile reassignment refreshes identity; cross-tab revocation closes stale views');
 assert(!storage.getItem(key).includes('DitaDemo123!'));assert(!storage.getItem(key).includes('TopHills!Demo26'));
 console.log('PASS Account archive stores salted password hashes, not passwords');
 for(const p of [-1,0,.24,.31,.38,.62,.69,.76,1,2]){const t=motion.sample(p);assert(t.scene>=0&&t.scene<=2);assert(t.opacity>=0&&t.opacity<=1);assert(Number.isFinite(t.x));assert.deepEqual(t,motion.sample(p));}
 for(const b of [.24,.38,.62,.76]){const a=motion.sample(b-1e-8),z=motion.sample(b+1e-8);for(const k of ['x','y','rotate','scale'])assert(Math.abs(a[k]-z[k])<.001,k+' at '+b)}
 console.log('PASS Scroll timeline clamps, reverses deterministically, and preserves image continuity');
 console.log('7 account and motion checks passed. No browser visual testing performed.');
})().catch(e=>{console.error(e);process.exitCode=1});
