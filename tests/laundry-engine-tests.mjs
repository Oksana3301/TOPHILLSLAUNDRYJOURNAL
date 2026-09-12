import test from 'node:test';import assert from 'node:assert/strict';
import {newOrder,transition,roomCatalog,alerts,clearState} from '../server/laundry-engine.mjs';
const owner={id:'owner',name:'Owner Fiktif',role:'Owner'},op={id:'op',name:'Operator Fiktif',role:'Operator'},finance={id:'finance',name:'Finance Fiktif',role:'Finance'},customer={id:'cust',role:'Customer'};
const at='2026-09-11T02:00:00.000Z',room={id:'A01',building:'A',floor:'1',roomType:'Kost',type:'Kost',checkout:''};
const p={name:'Pelanggan Fiktif',contact:'080000000000',relationship:'Penghuni',method:'pickup',serviceId:'THL-regular-refresh'};
const create=(actor=customer,kind='THL')=>newOrder({id:kind+'-11092026-A01-1',room,p,actor,kind,at});
const proofs=o=>[{id:'photo',order_id:o.id,capture:'live'},{id:'upload',order_id:o.id,capture:'upload'}];
const act=(o,a,v={},m=op)=>transition(o,a,v,m,proofs(o),at);
const received=()=>act(act(create(),'accept'),'receive',{proofId:'photo',bags:1,location:'Rak A'});
const priced=()=>act(act(received(),'weigh',{proofId:'photo',weight:2,quantity:0}),'approve-price',{},customer);
const paid=()=>act(act(priced(),'create-pay',{method:'Cash'}),'verify-pay',{proofId:'upload',amount:12000,reference:'FIKTIF'});
test('117 unique rooms include C Superior06',()=>{const rooms=roomCatalog();assert.equal(rooms.length,117);assert.equal(new Set(rooms.map(r=>r.id)).size,117);assert(rooms.some(r=>r.id==='CSUPERIOR06'));assert(rooms.every(r=>!r.active&&!r.floor));});
test('04 accept locks first staff; reassignment cannot replace acceptance',()=>{const a=act(create(),'accept');assert.throws(()=>act(a,'accept',{},owner));const b=act(a,'assign',{assignedTo:owner.id,reason:'Pergantian shift contoh'});assert.equal(b.acceptedBy.id,op.id);assert.equal(b.assignedTo,owner.id);});
test('05 revision acknowledgement required before pickup',()=>{const a=act(act(create(),'accept'),'revise',{...p,note:'Baru'},customer);assert.equal(a.customerRevision,2);assert.throws(()=>act(a,'receive',{proofId:'photo',bags:1,location:'Rak'}),/revisi/i);assert.equal(act(a,'accept',{},owner).acceptedBy.id,op.id);});
test('06 cancellation before acceptance closes without PAY or SET',()=>{const a=act(create(),'cancel',{reason:'Tidak jadi laundry'},customer);assert.equal(a.status,'CANCELLED');assert.equal(a.pay.status,'NOT CREATED');assert.equal(clearState(a),'CANCELLED CLEAR');});
test('07 cancellation after custody requires return evidence',()=>{const a=act(received(),'cancel',{reason:'Minta kembali'},customer);assert.equal(a.status,'RETURN REQUESTED');assert.throws(()=>act(a,'return',{recipient:'Fiktif'}));assert.equal(act(a,'return',{recipient:'Fiktif',proofId:'photo'}).status,'CANCELLED');});
test('08/09 assisted pending identity can weigh but cannot PAY/process',()=>{let o=create(op);o=act(act(o,'accept'),'receive',{proofId:'photo',bags:1,location:'Rak'});o=act(o,'weigh',{proofId:'photo',weight:2,quantity:0});assert(o.price);assert.throws(()=>act(o,'create-pay',{method:'Cash'}),/Identitas/);assert.throws(()=>act(o,'process',{batch:'M1',scannedId:o.id}),/Identitas/);});
test('10 unknown physical intake remains quarantined INT',()=>{const a=act(create(op,'INT'),'receive',{proofId:'photo',bags:1,location:'Karantina'});assert.equal(a.status,'QUARANTINE');assert.equal(a.pay.status,'NOT CREATED');assert.throws(()=>act(a,'weigh',{proofId:'photo',weight:2,quantity:0}));});
test('11 owner requires proof while customer may confirm their own assisted identity',()=>{const a=create(op);assert.throws(()=>act(a,'confirm-identity',{...p,reason:'Verifikasi kamar'},owner));assert.equal(act(a,'confirm-identity',p,customer).identity,'CONFIRMED');});
test('12 rejected ownership quarantines and raises incident',()=>{const a=act(create(op),'reject-ownership',{},customer);assert.equal(a.status,'QUARANTINE');assert(a.exceptions.some(e=>e.type==='OWNERSHIP REJECTED'));});
test('13 INT and pending identity processing blocked',()=>{assert.throws(()=>act(create(op,'INT'),'process'));assert.throws(()=>act(create(op),'create-pay',{method:'Cash'}));});
test('14 late physical intake raises exception',()=>{const a=act(act(create(),'accept'),'receive',{proofId:'photo',bags:1,location:'Rak',arrivedAt:'2026-09-11T01:50:00Z'});assert(a.exceptions.some(e=>e.type==='INTAKE >5 MINUTES'));});
test('16 Owner void preserves source; operator void denied',()=>{const o=create();assert.throws(()=>act(o,'void',{reason:'Duplikat contoh'}));assert.equal(act(o,'void',{reason:'Duplikat contoh'},owner).createdSource,'CUSTOMER QR');});
test('17 damaged label prevents process and relabel restores label',()=>{const o=act(priced(),'label-lost',{reason:'Label rusak'});assert.throws(()=>act(o,'process',{batch:'M1',scannedId:o.id}));assert.equal(act(o,'relabel',{proofId:'photo'}).label,true);});
test('18 price revision voids prior payment attempt',()=>{const o=act(act(priced(),'create-pay',{method:'Cash'}),'weigh',{proofId:'photo',weight:3,quantity:0});assert.equal(o.pay.attempts[0].status,'VOIDED');assert.equal(o.price.total,18000);assert.equal(o.priceApproved,false);});
test('19 expiry leaves THL status unchanged',()=>{const o=act(priced(),'create-pay',{method:'Cash'}),a=act(o,'expire-pay');assert.equal(a.status,o.status);assert.equal(a.pay.status,'EXPIRED');});
test('21 screenshot upload never marks PAID',()=>{const o=act(act(priced(),'create-pay',{method:'Transfer'}),'payment-proof',{proofId:'upload'});assert.equal(o.pay.status,'PENDING VERIFICATION');assert.throws(()=>act(o,'verify-pay',{amount:12000,reference:'BANK-FIKTIF',proofId:'upload'}),/Owner/);});
test('22 cash creates receipt and in-transit settlement',()=>{const o=paid();assert.equal(o.pay.status,'PAID');assert.equal(o.set.status,'IN TRANSIT');assert.equal(o.set.receivedBy,op.id);assert.match(o.pay.receiptNo,/CSH/);});
test('23 self settlement approval forbidden',()=>{const o=act(paid(),'submit-set',{proofId:'upload',actual:12000,fee:0,account:'BANK-FIKTIF',reference:'SET-FIKTIF'},owner);assert.throws(()=>act(o,'approve-set',{},owner),/Pemeriksa/);assert.equal(act(o,'approve-set',{},finance).set.status,'MATCHED');});
test('24 short settlement raises exception',()=>{const o=act(act(paid(),'submit-set',{proofId:'upload',actual:11000,fee:0,account:'BANK',reference:'SET'}),'approve-set',{},owner);assert.equal(o.set.status,'SHORT');assert(o.exceptions.some(e=>e.type==='SET SHORT'));});
test('25 paid cancel preserves PAY and makes refundable request',()=>{const o=act(paid(),'cancel',{reason:'Pembatalan fiktif'},customer);assert.equal(o.pay.status,'PAID');assert.equal(o.ref.status,'REQUESTED');const approved=act(o,'refund-approve',{reason:'Disetujui fiktif'},owner);assert.equal(act(approved,'refund-pay',{proofId:'upload',amount:12000},finance).ref.status,'REFUNDED');});
test('26 notification queue retries without pretending delivery',()=>{const o=act(create(),'notify-retry');assert.equal(o.notification.status,'QUEUED');assert.equal(o.id,create().id);assert.equal(o.notification.provider,'NOT CONNECTED');});
test('27 completion requires evidence and paid order',()=>{let o=act(priced(),'process',{batch:'MESIN-FIKTIF',scannedId:create().id});o=act(o,'ready',{proofId:'photo'});assert.throws(()=>act(o,'handover',{proofId:'photo',recipient:'Fiktif'}),/lunas/);let a=act(paid(),'process',{batch:'M1',scannedId:create().id});a=act(a,'ready',{proofId:'photo'});assert.throws(()=>act(a,'handover',{recipient:'Fiktif'}),/bukti/);assert.equal(act(a,'handover',{proofId:'photo',recipient:'Fiktif'}).status,'COMPLETED');});
test('28 checkout within24h escalates',()=>{const o=create();o.room.checkout='2026-09-11T10:00:00Z';assert(alerts(o,at).includes('Prioritas checkout <24 jam'));});
test('Gallery proof cannot substitute live intake',()=>{assert.throws(()=>act(act(create(),'accept'),'receive',{proofId:'upload',bags:1,location:'Rak'}),/kamera/)});
test('Customer cannot set payment/status or act as staff',()=>{assert.throws(()=>act(create(),'verify-pay',{amount:12000},customer),/pelanggan/);assert.throws(()=>act(create(),'accept',{},customer));});
test('QRIS unavailable without connected provider; no fake production success',()=>{assert.throws(()=>act(priced(),'create-pay',{method:'QRIS Demo'}),/belum terhubung/);});
test('Underpayment requires new attempt and never overwrites initial receipt',()=>{const o=act(act(priced(),'create-pay',{method:'Cash'}),'verify-pay',{proofId:'photo',amount:5000});assert.equal(o.pay.status,'UNDERPAID');assert.throws(()=>act(o,'verify-pay',{proofId:'photo',amount:7000}),/attempt/);const a=act(act(o,'create-pay',{method:'Cash'}),'verify-pay',{proofId:'photo',amount:7000});assert.equal(a.pay.status,'PAID');assert.deepEqual(a.pay.attempts.map(x=>x.received),[5000,7000]);});

const cancelledMissingReturn=(base=received())=>{
 const cancelled=act(act(base,'cancel',{reason:'Pembatalan fiktif'},customer),'return',{proofId:'photo',recipient:'Penerima fiktif'});
 delete cancelled.returnProof;cancelled.label=false;
 cancelled.exceptions.push({id:'missing-return-label',type:'RELABEL REQUIRED',open:true});
 return cancelled;
};
test('Missing return evidence is appended by Owner without rewriting the physical return or financial history',()=>{
 const original=cancelledMissingReturn(paid()),snapshot=structuredClone(original);
 const saved=act(original,'record-return-proof',{proofId:'upload',recipient:'Penerima fiktif',reason:'Bukti lama diperiksa dan dilengkapi'},owner);
 assert.deepEqual(original,snapshot);
 for(const field of ['status','custody','label','pay','set','ref','exceptions','receivedAt','receivedBy'])assert.deepEqual(saved[field],original[field]);
 assert.equal(saved.returnProof,'upload');
 assert.deepEqual(saved.returnEvidence,{recipient:'Penerima fiktif',by:owner.id,name:owner.name,recordedAt:at,reason:'Bukti lama diperiksa dan dilengkapi'});
 assert.equal(saved.returnEvidence.at,undefined);
 assert.equal(clearState(saved),'OPEN');
});
test('Missing return evidence cannot bypass role, custody, order state, or evidence requirements',()=>{
 const original=cancelledMissingReturn(),payload={proofId:'upload',recipient:'Penerima fiktif',reason:'Bukti lama diperiksa dan dilengkapi'};
 for(const actor of [op,finance,customer])assert.throws(()=>act(original,'record-return-proof',payload,actor),error=>error.status===403);
 for(const changed of [
  {...original,status:'RETURN REQUESTED'},
  {...original,status:'COMPLETED'},
  {...original,custody:true},
  {...original,kind:'INT'},
  {...original,intakeProof:null},
  {...original,returnProof:'photo'},
  {...original,exceptions:[]},
  {...original,exceptions:[{id:'closed',type:'RELABEL REQUIRED',open:false}]}
 ])assert.throws(()=>act(changed,'record-return-proof',payload,owner));
 for(const changed of [{...payload,proofId:'missing'},{...payload,recipient:''},{...payload,reason:''}])assert.throws(()=>act(original,'record-return-proof',changed,owner));
 assert.throws(()=>transition(original,'record-return-proof',payload,owner,[{id:'upload',order_id:'ANOTHER-ORDER',capture:'upload'}],at));
});
test('Appending return proof leaves exceptions open until the Owner checks and resolves each one',()=>{
 const original=cancelledMissingReturn();
 assert.throws(()=>act(original,'resolve-exception',{exceptionId:'missing-return-label',proofId:'upload',reason:'Barang sudah keluar'},owner),/Label/);
 const saved=act(original,'record-return-proof',{proofId:'upload',recipient:'Penerima fiktif',reason:'Bukti pengembalian sudah diperiksa'},owner);
 assert.equal(saved.exceptions.find(e=>e.id==='missing-return-label').open,true);
 assert.equal(clearState(saved),'OPEN');
 const resolved=act(saved,'resolve-exception',{exceptionId:'missing-return-label',proofId:'upload',reason:'Pengembalian barang sudah dibuktikan'},owner);
 assert.equal(clearState(resolved),'CANCELLED CLEAR');
 assert.equal(resolved.status,'CANCELLED');assert.equal(resolved.custody,false);assert.equal(resolved.label,false);
});
