import vm from 'node:vm';
import test,{after} from 'node:test';import {createTestDatabase} from './database-fixture.mjs';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {laundryRoute,hash} from '../server/laundry-api.mjs';
const {sql,DB,close}=await createTestDatabase();after(close);

const objects=new Map(),BUCKET={async put(k,b){objects.set(k,b)},async get(k){return objects.has(k)?{body:objects.get(k)}:null},async delete(k){objects.delete(k)}};const env={DB,BUCKET};
for(const [id,role,status] of [['owner','Owner','Aktif'],['op','Operator','Aktif'],['op2','Operator','Aktif'],['finance','Finance','Aktif'],['pending','Operator','Menunggu']])(await sql.prepare('INSERT INTO members VALUES(?,?,?,?,?,?,?)').run(id,id,id+'@example.test',role,status,'{}',new Date().toISOString()));
const data={name:'Pelanggan Fiktif',contact:'080000000000',relationship:'Penghuni',method:'pickup',serviceId:'THL-regular-refresh'};let roomToken,orderToken='a'.repeat(64),order;
async function call(path,p,{user='owner',token='',origin='https://local.test',method=p?'POST':'GET'}={}){const headers={'Authorization':'Bearer '+token,'X-Top-Hills':'1'};if(user)headers['oai-authenticated-user-id']=user;if(p)headers.Origin=origin;if(!(p instanceof FormData))headers['Content-Type']='application/json';try{const r=await laundryRoute(new Request('https://local.test/api/'+path,{method,headers,body:p instanceof FormData?p:p?JSON.stringify(p):undefined}),env);return {status:r.status,body:r.headers.get('Content-Type')?.includes('json')?await r.json():await r.arrayBuffer()};}catch(e){return {status:e.status||500,body:{error:e.message}}}}
async function act(action,extra={},user='op'){const r=await call('laundry/action',{id:order.id,revision:order.revision,mutationId:crypto.randomUUID(),action,...extra},{user});if(r.status===200)order=r.body.order;return r;}
test('01 room master initialization and Owner QR setup',async()=>{assert.equal((await call('laundry/rooms/init',{})).status,200);const r=await call('laundry/room',{id:'A01',revision:0,floor:'1',roomType:'Kost fiktif',active:true,rotate:true});assert.equal(r.status,200);roomToken=r.body.qrPath.split('=')[1];assert.equal((await call('portal/room',null,{user:null,token:roomToken})).body.room.id,'A01');assert(!JSON.stringify((await call('laundry/rooms')).body).includes(roomToken));assert.equal((await sql.prepare('SELECT token_hash FROM laundry_rooms WHERE id=?').get('A01')).token_hash,await hash(roomToken));});
test('02 duplicate customer submit creates one durable order',async()=>{const p={...data,orderToken};const a=await call('portal/submit',p,{user:null,token:roomToken}),b=await call('portal/submit',p,{user:null,token:roomToken});assert.equal(a.status,201,JSON.stringify(a));assert.equal(b.status,200);assert.equal(a.body.order.id,b.body.order.id);order=a.body.order;assert.equal((await sql.prepare('SELECT count(*) n FROM laundry_orders').get()).n,1);});
test('03 tampered room token and room override denied',async()=>{assert.equal((await call('portal/room',null,{user:null,token:'b'.repeat(64)})).status,404);assert.equal((await call('portal/submit',{...data,roomId:'B01',orderToken:'c'.repeat(64)},{user:null,token:roomToken})).status,403);});
test('Private order capability does not grant access to another order or staff',async()=>{assert.equal((await call('portal/order?id='+order.id,null,{user:null,token:roomToken})).status,404);assert.equal((await call('portal/order?id='+order.id,null,{user:null,token:orderToken})).status,200);assert.equal((await call('laundry/orders',null,{user:null,token:orderToken})).status,401);assert.equal((await call('laundry/orders',null,{user:'pending'})).status,403);});
test('04 concurrent accept only commits once; one first actor retained',async()=>{const p={id:order.id,revision:order.revision,action:'accept'};const results=await Promise.all(['op','op2'].map(user=>call('laundry/action',{...p,mutationId:crypto.randomUUID()},{user})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);order=results.find(r=>r.status===200).body.order;});
test('Exact lost-response retry returns same effect; changed mutation rejected',async()=>{const p={id:order.id,revision:order.revision,action:'notify-retry',mutationId:crypto.randomUUID()};const a=await call('laundry/action',p),b=await call('laundry/action',p);assert.equal(a.status,200);assert.equal(a.body.order.revision,b.body.order.revision);assert.equal((await call('laundry/action',{...p,action:'hold'})).status,409);order=a.body.order;});
test('Mutations reject cross origin and DELETE',async()=>{assert.equal((await call('laundry/action',{id:order.id},{origin:'https://evil.test'})).status,403);assert.equal((await call('laundry/action',{id:order.id},{method:'DELETE'})).status,405);});
test('Operator cannot change master; Finance cannot receive goods',async()=>{assert.equal((await call('laundry/room',{id:'A01'},{user:'op'})).status,403);assert.equal((await act('receive',{},'finance')).status,403);});
test('Proof persistence supports bytes and protected reading',async()=>{const f=new FormData();f.set('orderId',order.id);f.set('capture','live');f.set('file',new File([new Uint8Array([255,216,255,10,20])],'test.jpg',{type:'image/jpeg'}));const r=await call('laundry/proof',f,{user:'op'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(objects.size,1);assert.deepEqual(Object.keys(r.body.proof).sort(),['capture','created_at','id','mime']);assert.equal(r.body.proof.id,r.body.id);assert.equal(r.body.proof.capture,'live');assert(Number.isFinite(Date.parse(r.body.proof.created_at)));assert.equal((await call('laundry/proof?id='+r.body.id,null,{user:null})).status,401);assert.equal((await call('laundry/proof?id='+r.body.id)).status,200);assert.equal((await act('receive',{proofId:r.body.id,bags:1,location:'Rak fiktif'})).status,200);});
test('Customer gallery evidence never becomes live intake evidence',async()=>{const f=new FormData();f.set('orderId',order.id);f.set('capture','live');f.set('file',new File([new Uint8Array([255,216,255])],'test.jpg'));const r=await call('portal/proof',f,{user:null,token:orderToken});assert.equal(r.status,200);assert.equal(r.body.capture,'upload');});
test('13 denied process is logged, state stays intact',async()=>{const r=await act('process',{batch:'FIKTIF',scannedId:order.id});assert.equal(r.status,400);assert((await sql.prepare("SELECT count(*) n FROM laundry_events WHERE action='DENIED process'").get()).n>0);});
test('15 empty machine batch denied and audited',async()=>{assert.equal((await call('laundry/machine',{batch:'M1',orderIds:[]})).status,400);assert((await sql.prepare("SELECT count(*) n FROM laundry_events WHERE action='MACHINE ATTEMPT'").get()).n>0);});
test('10 unknown assisted intake creates INT; submitted retry stable',async()=>{const p={...data,name:'',contact:'',roomId:'MISSING',mutationId:crypto.randomUUID()};const a=await call('laundry/assisted',p,{user:'op'}),b=await call('laundry/assisted',p,{user:'op'});assert.equal(a.status,200);assert.equal(a.body.order.kind,'INT');assert.equal(a.body.order.id,b.body.order.id);assert.equal(a.body.order.pay.status,'NOT CREATED');});
test('Room QR rotation invalidates old room QR but preserves private order tracking',async()=>{const r=await call('laundry/room',{id:'A01',revision:1,floor:'1',roomType:'Kost',active:true,rotate:true});assert.equal(r.status,200);assert.equal((await call('portal/room',null,{user:null,token:roomToken})).status,404);assert.equal((await call('portal/order?id='+order.id,null,{user:null,token:orderToken})).status,200);});
test('Custom date range validates order and limits page',async()=>{assert.equal((await call('laundry/orders?start=2026-09-15&end=2026-09-01')).status,400);assert.equal((await call('laundry/orders?start=2020-01-01&end=2020-01-31')).body.orders.length,0);});
test('20 provider webhook is unavailable: cannot fabricate QRIS success',async()=>{assert.equal((await call('portal/webhook',{event:'PAID'},{user:null})).status,404);});
test('INT links exactly once to THL and preserves physical custody count',async()=>{const made=await call('laundry/assisted',{...data,roomId:'UNKNOWN',mutationId:crypto.randomUUID()},{user:'op'});const intake=made.body.order,f=new FormData();f.set('orderId',intake.id);f.set('file',new File([new Uint8Array([255,216,255])],'proof.jpg'));f.set('capture','live');const proof=await call('laundry/proof',f);const received=await call('laundry/action',{id:intake.id,revision:1,mutationId:crypto.randomUUID(),action:'receive',proofId:proof.body.id,bags:2,location:'Karantina'});assert.equal(received.status,200);const p={id:intake.id,revision:received.body.order.revision,roomId:'A01',...data,proofId:proof.body.id,reason:'Kamar dan pemilik terverifikasi'};const linked=await call('laundry/link-int',p);assert.equal(linked.status,200,JSON.stringify(linked));assert.equal((await call('laundry/link-int',p)).status,400);const source=JSON.parse((await sql.prepare('SELECT data FROM laundry_orders WHERE id=?').get(intake.id)).data);assert.equal(source.status,'LINKED');assert.equal(source.custody,false);assert.equal(linked.body.order.custody,true);assert.equal(linked.body.order.label,false);assert.equal(linked.body.order.status,'PICKED UP');assert(linked.body.order.intakeProof);let current=linked.body.order;for(const [action,extra] of [['accept',{}],['relabel',{proofId:current.intakeProof}],['weigh',{proofId:current.intakeProof,weight:2,quantity:0}]]){const moved=await call('laundry/action',{id:current.id,revision:current.revision,mutationId:crypto.randomUUID(),action,...extra},{user:'op'});assert.equal(moved.status,200,JSON.stringify(moved));current=moved.body.order;}assert(current.price);});
test('Logged-in staff cannot impersonate customer QR source',async()=>{const r=await call('laundry/room',{id:'A01',revision:2,floor:'1',roomType:'Kost',active:true,rotate:true});const t=r.body.qrPath.split('=')[1];assert.equal((await call('portal/submit',{...data,orderToken:'f'.repeat(64)},{user:'owner',token:t})).status,403);});
test('Portal finance detection makes unique proposals without posting or copying customer order into legacy blob',async()=>{const {importLaundryFinance}=await import('../server/laundry-finance.mjs');const row=(await sql.prepare('SELECT data FROM laundry_orders WHERE id=?').get(order.id)),o=JSON.parse(row.data);o.status='COMPLETED';o.handoverProof='none';o.handover={at:new Date().toISOString()};o.price={total:12000,service:{name:'Regular Refresh'}};o.pay={received:12000,status:'PAID',method:'Cash',attempts:[{id:'PAY-EXAMPLE-A01',received:12000,receivedAt:new Date().toISOString(),method:'Cash',reference:'FIKTIF'}]};(await sql.prepare('UPDATE laundry_orders SET status=?,data=? WHERE id=?').run(o.status,JSON.stringify(o),o.id));const w={finance:{transactions:[],attachments:[]}};assert.equal(await importLaundryFinance(env,w,{id:'owner'}),2);assert.equal(await importLaundryFinance(env,w,{id:'owner'}),0);assert(w.finance.transactions.every(t=>t.status==='Diajukan'&&t.portalManaged));assert.equal((await sql.prepare('SELECT count(*) n FROM journals').get()).n,0);});
test('Shift handover records discrepancies, retains independent review and cannot self-approve',async()=>{const summary=(await call('laundry/summary')).body.summary;const form=new FormData();form.set('orderId','SHIFT-'+crypto.randomUUID());form.set('file',new File([new Uint8Array([255,216,255])],'closing.jpg'));const proof=(await call('laundry/proof',form,{user:'op'})).body;const r=await call('laundry/shift',{physicalBags:summary.physicalBags+1,cash:summary.cashInTransit||0,note:'Handover uji fiktif dengan selisih',proofId:proof.id,mutationId:crypto.randomUUID()},{user:'op'});assert.equal(r.status,200);assert.equal((await call('laundry/shift-review',{id:r.body.id,note:'Mencoba review sendiri'},{user:'op'})).status,403);const reviewed=await call('laundry/shift-review',{id:r.body.id,note:'Selisih tetap ditindaklanjuti'});assert.equal(reviewed.status,200);assert.equal(reviewed.body.status,'EXCEPTION OPEN');});

test('Customer only reads own operational evidence, never bank or other-order proofs',async()=>{const row=(await sql.prepare('SELECT data FROM laundry_orders WHERE id=?').get(order.id)),o=JSON.parse(row.data);assert.equal((await call('portal/proof?orderId='+o.id+'&id='+o.intakeProof,null,{user:null,token:orderToken})).status,200);assert.equal((await call('portal/proof?orderId='+o.id+'&id='+o.intakeProof,null,{user:null,token:'b'.repeat(64)})).status,404);const f=new FormData();f.set('orderId',o.id);f.set('file',new File([new Uint8Array([255,216,255])],'bank.jpg'));const privateProof=(await call('laundry/proof',f)).body;assert.equal((await call('portal/proof?orderId='+o.id+'&id='+privateProof.id,null,{user:null,token:orderToken})).status,404);});

test('Multiple packages survive API persistence, revision conflicts and customer approval after an operator exception',async()=>{
 const made=await call('laundry/assisted',{...data,roomId:'A01',serviceIds:['THL-regular-refresh','THL-bed-cover-l'],mutationId:crypto.randomUUID()},{user:'op'});
 assert.equal(made.status,200,JSON.stringify(made));let current=made.body.order;
 assert.equal(made.body.trackingPath,undefined);
 const tracking=await call('laundry/tracking',{id:current.id},{user:'owner'});assert.equal(tracking.status,200);
 const key=new URLSearchParams(tracking.body.trackingPath.split('#')[1]).get('key');assert(key);
 const f=new FormData();f.set('orderId',current.id);f.set('capture','live');f.set('file',new File([new Uint8Array([255,216,255,10])],'intake.jpg',{type:'image/jpeg'}));
 const proof=(await call('laundry/proof',f,{user:'op'})).body;
 const step=async(action,extra={},user='op')=>{const r=await call('laundry/action',{id:current.id,revision:current.revision,action,mutationId:crypto.randomUUID(),...extra},{user});assert.equal(r.status,200,JSON.stringify(r));current=r.body.order;};
 await step('confirm-identity',{...data,serviceIds:['THL-regular-refresh','THL-bed-cover-l'],proofId:proof.id,reason:'Pemilik dan kamar sudah diperiksa'},'owner');
 await step('accept');await step('receive',{proofId:proof.id,bags:2,location:'Rak uji'});
 const before=current.revision,lines=[{serviceId:'THL-regular-refresh',weight:3},{serviceId:'THL-bed-cover-l',quantity:1}];
 await step('weigh',{proofId:proof.id,lines});assert.equal(current.price.total,53000);
 assert.equal((await call('laundry/action',{id:current.id,revision:before,action:'weigh',proofId:proof.id,lines,mutationId:crypto.randomUUID()})).status,409);
 const persisted=JSON.parse((await sql.prepare('SELECT data FROM laundry_orders WHERE id=?').get(current.id)).data);
 assert.equal(persisted.price.lines.length,2);assert.equal((await sql.prepare("SELECT count(*) n FROM laundry_events WHERE order_id=? AND action='weigh'").get(current.id)).n,1);
 await step('process',{batch:'M1',scannedId:current.id,proceedWithoutApproval:true,overrideContext:'CUSTOMER_BUSY',reason:'Pelanggan sedang rapat dan sebelumnya sudah meminta pekerjaan dilanjutkan.'});
 const publicOrder=(await call('portal/order?id='+current.id,null,{user:null,token:key})).body.order;
 assert.equal(publicOrder.priceApproved,false);assert.equal(publicOrder.price.lines.length,2);assert(publicOrder.processingException.reason);assert.equal(publicOrder.processAuthorization,undefined);
 const approved=await call('portal/action',{id:current.id,revision:current.revision,action:'approve-price',mutationId:crypto.randomUUID()},{user:null,token:key});
 assert.equal(approved.status,200,JSON.stringify(approved));assert.equal(approved.body.order.priceApproved,true);
 const saved=JSON.parse((await sql.prepare('SELECT data FROM laundry_orders WHERE id=?').get(current.id)).data);
 assert.equal(saved.status,'IN PROCESS');assert.equal(saved.priceApproval.via,'CUSTOMER PORTAL');assert.equal(saved.exceptions.find(e=>e.type==='PROCESS WITHOUT CUSTOMER APPROVAL').open,false);
});

test('Only Owner may issue a THL customer link; denied requests never rotate existing links',async()=>{
 const made=await call('laundry/assisted',{...data,roomId:'A01',mutationId:crypto.randomUUID()},{user:'owner'});
 assert.equal(made.status,200);const id=made.body.order.id,originalKey=new URLSearchParams(made.body.trackingPath.split('#')[1]).get('key');
 const before=await sql.prepare('SELECT token_hash,data,revision FROM laundry_orders WHERE id=?').get(id);
 const eventCount=(await sql.prepare("SELECT count(*) n FROM laundry_events WHERE order_id=? AND action='ROTATE TRACKING'").get(id)).n;
 for(const user of ['op','finance']){
  assert.equal((await call('laundry/tracking',{id},{user})).status,403);
  assert.equal((await call('laundry/tracking',{id:'THL-NOT-FOUND'},{user})).status,403);
 }
 assert.equal((await call('laundry/tracking',{id},{user:null})).status,401);
 assert.deepEqual(await sql.prepare('SELECT token_hash,data,revision FROM laundry_orders WHERE id=?').get(id),before);
 assert.equal((await sql.prepare("SELECT count(*) n FROM laundry_events WHERE order_id=? AND action='ROTATE TRACKING'").get(id)).n,eventCount);
 assert.equal((await call('portal/order?id='+id,null,{user:null,token:originalKey})).status,200);
 const rotated=await call('laundry/tracking',{id},{user:'owner'});
 assert.equal(rotated.status,200);const nextKey=new URLSearchParams(rotated.body.trackingPath.split('#')[1]).get('key');
 assert.notEqual(nextKey,originalKey);
 assert.equal((await call('portal/order?id='+id,null,{user:null,token:originalKey})).status,404);
 assert.equal((await call('portal/order?id='+id,null,{user:null,token:nextKey})).status,200);
 assert.equal((await sql.prepare("SELECT count(*) n FROM laundry_events WHERE order_id=? AND action='ROTATE TRACKING'").get(id)).n,eventCount+1);
});

test('Assisted responses reveal links only for Owner THL, never Operator, INT, or replay',async()=>{
 for(const user of ['owner','op']){
  for(const roomId of ['A01','UNKNOWN']){
   const payload={...data,roomId,mutationId:crypto.randomUUID()};
   const made=await call('laundry/assisted',payload,{user}),replay=await call('laundry/assisted',payload,{user});
   assert.equal(made.status,200);assert.equal(replay.status,200);
   assert.equal(made.body.order.id,replay.body.order.id);
   assert.equal(Object.hasOwn(made.body,'trackingPath'),user==='owner'&&roomId==='A01');
   assert.equal(Object.hasOwn(replay.body,'trackingPath'),false);
   for(const response of [made,replay]){
    assert.equal(Object.hasOwn(response.body.order,'token_hash'),false);
    assert.equal(Object.hasOwn(response.body.order,'orderToken'),false);
   }
   if(roomId==='UNKNOWN'){
    assert.equal(made.body.order.kind,'INT');
    assert.equal((await call('laundry/tracking',{id:made.body.order.id},{user:'owner'})).status,400);
   }
  }
 }
});

test('Customer portal blocks active staff impersonation; Owner preview is read-only and anonymous customers retain access',async()=>{
 const made=await call('laundry/assisted',{...data,roomId:'A01',mutationId:crypto.randomUUID()},{user:'owner'});
 let current=made.body.order;const key=new URLSearchParams(made.body.trackingPath.split('#')[1]).get('key');
 const photo=()=>{const f=new FormData();f.set('orderId',current.id);f.set('capture','live');f.set('file',new File([new Uint8Array([255,216,255,10])],'fictitious-proof.jpg',{type:'image/jpeg'}));return f;};
 const uploaded=await call('laundry/proof',photo(),{user:'op'});assert.equal(uploaded.status,200);
 for(const [action,extra] of [['accept',{}],['receive',{proofId:uploaded.body.id,bags:1,location:'Rak uji'}]]){
  const next=await call('laundry/action',{id:current.id,revision:current.revision,action,mutationId:crypto.randomUUID(),...extra},{user:'op'});
  assert.equal(next.status,200);current=next.body.order;
 }
 const stored=await sql.prepare('SELECT data,revision FROM laundry_orders WHERE id=?').get(current.id),files=objects.size;
 const confirmation={...data,id:current.id,revision:current.revision,action:'confirm-identity',mutationId:crypto.randomUUID()};
 for(const user of ['op','finance']){
  assert.equal((await call('portal/order?id='+current.id,null,{user,token:key})).status,403);
  assert.equal((await call('portal/proof?orderId='+current.id+'&id='+uploaded.body.id,null,{user,token:key})).status,403);
 }
 for(const user of ['owner','op','finance']){
  assert.equal((await call('portal/action',confirmation,{user,token:key})).status,403);
  assert.equal((await call('portal/proof',photo(),{user,token:key})).status,403);
 }
 assert.deepEqual(await sql.prepare('SELECT data,revision FROM laundry_orders WHERE id=?').get(current.id),stored);
 assert.equal(objects.size,files);
 for(const user of ['owner',null]){
  const preview=await call('portal/order?id='+current.id,null,{user,token:key});assert.equal(preview.status,200);assert.equal(preview.body.readOnly,user==='owner');
  assert.equal((await call('portal/proof?orderId='+current.id+'&id='+uploaded.body.id,null,{user,token:key})).status,200);
 }
 const confirmed=await call('portal/action',confirmation,{user:null,token:key});
 assert.equal(confirmed.status,200);assert.equal(confirmed.body.order.identity,'CONFIRMED');
 for(const user of ['owner','op','finance'])assert.equal((await call('portal/action',confirmation,{user,token:key})).status,403);
 const customerPhoto=await call('portal/proof',photo(),{user:null,token:key});
 assert.equal(customerPhoto.status,200);assert.equal(customerPhoto.body.capture,'upload');
});

test('An old INT capability cannot open customer pages or create customer actions',async()=>{
 const made=await call('laundry/assisted',{...data,roomId:'UNKNOWN',mutationId:crypto.randomUUID()},{user:'op'});
 const id=made.body.order.id,legacyKey='d'.repeat(64);
 await sql.prepare('UPDATE laundry_orders SET token_hash=? WHERE id=?').run(await hash(legacyKey),id);
 assert.equal((await call('portal/order?id='+id,null,{user:null,token:legacyKey})).status,404);
 assert.equal((await call('portal/order?id='+id,null,{user:'owner',token:legacyKey})).status,404);
 assert.equal((await call('portal/action',{id,revision:1,action:'confirm-identity',mutationId:crypto.randomUUID(),...data},{user:null,token:legacyKey})).status,404);
 assert.equal((await call('portal/proof?orderId='+id+'&id=missing',null,{user:null,token:legacyKey})).status,404);
 assert.equal((await call('laundry/tracking',{id},{user:'owner'})).status,400);
});

test('Owner may append missing return evidence to a cancelled record with revision protection and an audit trail',async()=>{
 const made=await call('laundry/assisted',{...data,roomId:'A01',mutationId:crypto.randomUUID()},{user:'owner'});
 let current=made.body.order;
 const form=new FormData();form.set('orderId',current.id);form.set('file',new File([new Uint8Array([255,216,255])],'return-proof.jpg'));
 const proof=await call('laundry/proof',form);assert.equal(proof.status,200);
 // Reproduce a legacy cancelled record in this isolated test database, never production.
 current={...current,status:'CANCELLED',custody:false,label:false,intakeProof:proof.body.id,exceptions:[{id:'legacy-label',type:'RELABEL REQUIRED',open:true}]};
 await sql.prepare('UPDATE laundry_orders SET status=?,data=? WHERE id=?').run(current.status,JSON.stringify(current),current.id);
 const payload={id:current.id,revision:current.revision,action:'record-return-proof',proofId:proof.body.id,recipient:'Penerima fiktif',reason:'Melengkapi bukti pengembalian yang sudah dilakukan',mutationId:crypto.randomUUID()};
 for(const user of ['op','finance'])assert.equal((await call('laundry/action',payload,{user})).status,403);
 assert.equal((await call('laundry/action',{...payload,proofId:'missing'},{user:'owner'})).status,400);
 const before=await sql.prepare('SELECT data,revision FROM laundry_orders WHERE id=?').get(current.id);
 const saved=await call('laundry/action',payload,{user:'owner'});assert.equal(saved.status,200,JSON.stringify(saved));
 assert.equal(saved.body.order.status,'CANCELLED');assert.equal(saved.body.order.custody,false);assert.equal(saved.body.order.label,false);
 for(const field of ['pay','set','ref','exceptions'])assert.deepEqual(saved.body.order[field],current[field]);
 assert.equal(saved.body.order.returnProof,proof.body.id);assert.equal(saved.body.order.returnEvidence.by,'owner');
 assert.equal(saved.body.order.returnEvidence.at,undefined);assert(Number.isFinite(Date.parse(saved.body.order.returnEvidence.recordedAt)));
 const retry=await call('laundry/action',payload,{user:'owner'});assert.equal(retry.status,200);assert.equal(retry.body.order.revision,before.revision+1);
 assert.equal((await sql.prepare("SELECT count(*) n FROM laundry_events WHERE order_id=? AND action='record-return-proof'").get(current.id)).n,1);
 assert.equal((await call('laundry/action',{...payload,mutationId:crypto.randomUUID(),revision:saved.body.order.revision},{user:'owner'})).status,400);
 const resolved=await call('laundry/action',{id:current.id,revision:saved.body.order.revision,action:'resolve-exception',exceptionId:'legacy-label',proofId:proof.body.id,reason:'Barang sudah dikembalikan dan bukti diperiksa',mutationId:crypto.randomUUID()},{user:'owner'});
 assert.equal(resolved.status,200);assert.equal(resolved.body.order.clear,'CANCELLED CLEAR');
});

function portalPreviewHarness(){
 const nodes=new Map(),element=()=>({innerHTML:'',textContent:'',className:'',disabled:false,listeners:{},addEventListener(name,handler){this.listeners[name]=handler;}});
 nodes.set('#view',element());nodes.set('#message',element());
 const get=selector=>{
  if(nodes.has(selector)&&['#view','#message'].includes(selector))return nodes.get(selector);
  if(!nodes.get('#view').innerHTML.includes('id="'+selector.slice(1)+'"'))return null;
  if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);
 };
 const context={console,document:{querySelector:get,querySelectorAll:()=>[]},URLSearchParams,AbortSignal,FormData,File,crypto,structuredClone,location:{hash:'#order=THL-PREVIEW&key='+ 'e'.repeat(64),href:'https://local.test/checkin'},navigator:{clipboard:{writeText:async()=>{}}}};
 context.window=context;vm.createContext(context);
 for(const file of ['copy.js','laundry-labels.js','services-core.js','laundry-ui.js'])vm.runInContext(readFileSync('dist/'+file,'utf8'),context);
 const portal=readFileSync('dist/portal.js','utf8'),startup=portal.lastIndexOf('\n(async()=>{');assert(startup>0);
 vm.runInContext(portal.slice(0,startup),context);
 const fixture={id:'THL-PREVIEW',customer:{...data},room:{id:'A01',building:'A',floor:'1',roomType:'Kost'},status:'PRICE CONFIRMATION PENDING',identity:'PENDING',revision:1,customerRevision:1,acceptedRevision:1,acceptedName:'Petugas fiktif',price:{service:{id:'THL-regular-refresh',name:'Regular Refresh',unit:'Kg',price:6000},billedQuantity:2,total:12000},priceApproved:false,pay:{status:'UNPAID',received:0},ref:{status:'NONE'},proofs:[]};
 const calls=[],h={context,fixture,calls,get,readOnly:true,ok:true,run:code=>vm.runInContext(code,context)};
 context.fetch=async(url,options)=>{calls.push({url,options});return {ok:h.ok,json:async()=>h.ok?{order:structuredClone(fixture),...(h.readOnly===undefined?{}:{readOnly:h.readOnly})}:{error:'Tautan ini hanya untuk pelanggan.'}};};
 return h;
}
test('Owner customer preview hides writes and refuses direct action calls in the UI',async()=>{
 const h=portalPreviewHarness();await h.run('loadOrder()');const html=h.get('#view').innerHTML;
 assert(html.includes('pemeriksaan Owner'));
 for(const id of ['approve','confirm','reject','cancel','customer-photo','revise'])assert(!html.includes('id="'+id+'"'),id);
 await h.run("action('approve-price')");
 assert.equal(h.calls.filter(c=>c.options.method==='POST').length,0);
 assert.equal(h.run('readOnly'),true);
});
test('Customer controls follow the latest access response and disappear immediately when access fails',async()=>{
 const h=portalPreviewHarness();await h.run('loadOrder()');h.readOnly=false;await h.run('loadOrder()');
 for(const id of ['approve','confirm','reject','cancel','customer-photo','revise'])assert(h.get('#view').innerHTML.includes('id="'+id+'"'),id);
 assert.equal(h.run('readOnly'),false);
 await h.run("action('approve-price')");assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);
 h.ok=false;await h.run('loadOrder()');assert.equal(h.run('readOnly'),true);assert.equal(h.run('order'),null);
 assert(!h.get('#view').innerHTML.includes('id="approve"'));
 h.ok=true;h.readOnly=undefined;await h.run('loadOrder()');assert.equal(h.run('readOnly'),true);assert(!h.get('#view').innerHTML.includes('id="customer-photo"'));
});
test('A delayed customer response cannot restore write controls over a newer Owner preview',async()=>{
 const h=portalPreviewHarness(),pending=[];
 h.context.fetch=()=>new Promise(resolve=>pending.push(resolve));
 const earlier=h.run('loadOrder()'),latest=h.run('loadOrder()');
 pending[1]({ok:true,json:async()=>({order:structuredClone(h.fixture),readOnly:true})});await latest;
 pending[0]({ok:true,json:async()=>({order:structuredClone(h.fixture),readOnly:false})});await earlier;
 assert.equal(h.run('readOnly'),true);assert(!h.get('#view').innerHTML.includes('id="approve"'));
});
