import {newOrder,transition,need,clean,clearState,alerts} from './laundry-engine.mjs';
import {hash} from './laundry-api.mjs';
import Services from '../dist/services-core.js';
const q=(env,sql,...v)=>env.DB.prepare(sql).bind(...v);
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const actors={Customer:{id:'demo-customer',name:'Pelanggan Contoh',role:'Customer'},Operator:{id:'demo-operator',name:'Operator Contoh',role:'Operator'},Owner:{id:'demo-owner',name:'Owner Contoh',role:'Owner'},Finance:{id:'demo-finance',name:'Finance Contoh',role:'Finance'}};
const room={id:'A01',building:'A',floor:'1',roomType:'Kost contoh · DEMO',type:'Kost',checkout:''};
function view(row){const s=JSON.parse(row.data);return {simulation:true,revision:row.revision,expiresAt:row.expires_at,room,services:Services.catalog(),orders:s.orders.map(o=>({...o,clear:clearState(o),alerts:alerts(o)})),events:s.events};}
export async function laundryDemoRoute(req,env){
 const url=new URL(req.url),secret=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 need(env.DB,'Ruang latihan belum tersedia.',503);need(/^[a-f0-9]{64}$/.test(secret),'Tautan ruang latihan tidak valid.',404);
 const key=await hash('laundry-demo:'+secret);let row=await q(env,'SELECT * FROM laundry_demo_sessions WHERE id=?',key).first();
 if(req.method==='GET'){need(row&&row.expires_at>Date.now(),'Ruang latihan belum dimulai atau kedaluwarsa.',404);return json(view(row));}
 need(req.method==='POST'&&req.headers.get('Origin')===url.origin&&req.headers.get('X-Top-Hills')==='1','Permintaan lintas situs ditolak.',403);
 const raw=await req.text();need(raw.length<8000,'Form terlalu panjang.',413);const p=JSON.parse(raw);
 if(url.pathname==='/api/laundry-demo/start'){
  if(row){need(row.expires_at>Date.now(),'Ruang latihan telah kedaluwarsa. Buat ruang baru.',410);return json(view(row));}
  const ipHash=await hash('demo-limit:'+ (req.headers.get('CF-Connecting-IP')||'unknown')+':'+Math.floor(Date.now()/3600000));
  const limit=await q(env,'INSERT INTO auth_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',ipHash,Date.now()+3600000).first();need(limit.count<=15,'Batas pembuatan ruang latihan tercapai. Coba satu jam lagi.',429);
  await q(env,'DELETE FROM laundry_demo_sessions WHERE expires_at<?',Date.now()).run();
  const count=await q(env,'SELECT count(*) n FROM laundry_demo_sessions').first();need(count.n<1000,'Ruang latihan sedang penuh.',429);
  await q(env,'INSERT OR IGNORE INTO laundry_demo_sessions VALUES(?,?,?,?)',key,0,Date.now()+7*86400000,JSON.stringify({orders:[],events:[],mutations:[],counter:0})).run();
  row=await q(env,'SELECT * FROM laundry_demo_sessions WHERE id=?',key).first();return json(view(row),201);
 }
 need(url.pathname==='/api/laundry-demo/action','Halaman tidak tersedia.',404);need(row&&row.expires_at>Date.now(),'Ruang latihan kedaluwarsa. Buat ruang baru.',410);
 const state=JSON.parse(row.data);need(/^[a-zA-Z0-9-]{16,80}$/.test(p.mutationId||''),'Kunci pengiriman wajib.');
 const fingerprint=await hash(raw),prior=state.mutations.find(x=>x.id===p.mutationId);
 if(prior){need(prior.hash===fingerprint,'Kunci telah digunakan untuk pengiriman berbeda.',409);return json(view(row));}
 need(p.revision===row.revision,'Data berubah di perangkat lain. Muat ulang lalu ulangi tindakan.',409);
 const actor=actors[p.role];need(actor,'Pilih peran latihan.');let order;
 if(p.action==='submit'){
  need(actor.role==='Customer','Gunakan tab pelanggan untuk check-in.');need(state.orders.length<10,'Maksimal 10 order per ruang latihan. Buat ruang baru.');need(!p.roomId||p.roomId===room.id,'Kamar dikunci oleh QR.',403);
  state.counter++;const day=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()).replaceAll('/','');
  order=newOrder({id:'THL-'+day+'-A01-'+state.counter,room,p:{...p,contact:'080000000000'},actor});order.simulation=true;state.orders.push(order);
 }else{
  const ix=state.orders.findIndex(o=>o.id===p.id);need(ix>=0,'Order latihan tidak ditemukan.',404);order=state.orders[ix];need(order.simulation===true,'Hanya data latihan yang diperbolehkan.',403);
  const proofs=[{id:'demo-photo',order_id:order.id,capture:'live'},{id:'demo-upload',order_id:order.id,capture:'upload'}];
  order=transition(order,p.action,p,actor,proofs);order.revision++;state.orders[ix]=order;
 }
 state.events.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),orderId:order.id,action:p.action,actor:actor.name,role:actor.role,status:order.status,simulation:true});state.events=state.events.slice(0,120);
 state.mutations.push({id:p.mutationId,hash:fingerprint});need(state.mutations.length<=250,'Batas langkah latihan tercapai. Buat ruang baru.');
 const content=JSON.stringify(state);need(content.length<200000,'Ruang latihan penuh. Buat ruang baru.');const saved=await q(env,'UPDATE laundry_demo_sessions SET data=?,revision=revision+1 WHERE id=? AND revision=?',content,key,row.revision).run();need(saved.meta.changes===1,'Perangkat lain baru menyimpan. Muat ulang.',409);
 return json(view({...row,data:content,revision:row.revision+1}));
}
