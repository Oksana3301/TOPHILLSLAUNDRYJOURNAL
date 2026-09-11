import test from 'node:test';
import assert from 'node:assert/strict';
import {newOrder,transition} from '../server/laundry-engine.mjs';
import {serviceSelection,quotePackages} from '../server/laundry-pricing.mjs';
const ids=['THL-regular-refresh','THL-bed-cover-l','THL-cukedo'];
const p={name:'Pelanggan Uji',contact:'080000000000',relationship:'Penghuni',method:'pickup',serviceIds:ids};
const room={id:'A01',building:'A',floor:'1',type:'Kost',roomType:'Uji'};
const operator={id:'operator',name:'Operator Uji',role:'Operator'},owner={id:'owner',name:'Owner Uji',role:'Owner'},customer={id:'customer',role:'Customer'};
const fresh=()=>newOrder({id:'THL-11092026-A01-1',room,p,actor:customer});
const act=(o,a,v={},m=operator)=>transition(o,a,v,m,[{id:'photo',order_id:o.id,capture:'live'}]);
const lines=[{serviceId:ids[0],weight:2.5},{serviceId:ids[1],quantity:2},{serviceId:ids[2],weight:3}];
const received=()=>act(act(fresh(),'accept'),'receive',{proofId:'photo',bags:2,location:'Rak uji'});
const weighed=()=>act(received(),'weigh',{proofId:'photo',lines});
const exception=o=>({batch:'M1',scannedId:o.id,proceedWithoutApproval:true,overrideContext:'LONG_WAIT',reason:'Sudah menunggu tiga jam dan pelanggan telah meminta pekerjaan dilanjutkan.'});

test('mixed packages retain individual KG, unit and load prices without combining weights',()=>{
 const o=weighed();assert.deepEqual(o.customer.serviceIds,ids);assert.equal(o.customer.serviceId,ids[0]);
 assert.deepEqual(o.price.lines.map(l=>l.total),[15000,70000,30000]);assert.equal(o.price.total,115000);
 assert.deepEqual(o.price.lines.map(l=>l.billedQuantity),[2.5,2,2]);assert.equal(o.priceApproved,false);
});
test('package validation rejects empty, duplicate, unknown and malformed selections',()=>{
 for(const serviceIds of [[],[ids[0],ids[0]],['unknown'],'wrong',null])assert.throws(()=>serviceSelection({serviceIds}),e=>e.status===400);
 for(const bad of [[],[{serviceId:ids[0],weight:1}],[{serviceId:ids[1],quantity:1.5}],[{serviceId:ids[2],weight:0}],[{serviceId:ids[0],weight:Infinity}],[null]])assert.throws(()=>quotePackages({lines:bad},p),e=>e.status===400);
 assert.throws(()=>quotePackages({weight:2},p));
});
test('legacy single-package check-in and pricing remain compatible',()=>{
 const legacy={...p,serviceIds:undefined,serviceId:ids[0]};const o=newOrder({id:'legacy',room,p:legacy,actor:customer});
 assert.deepEqual(o.customer.serviceIds,[ids[0]]);assert.equal(quotePackages({weight:2},o.customer).total,12000);
});
test('reweigh preserves old quote and actor, voids unpaid requests and requires new approval',()=>{
 let o=act(weighed(),'approve-price',{},customer);o=act(o,'create-pay',{method:'Cash'});o=act(o,'payment-proof',{proofId:'photo'});
 o=act(o,'weigh',{proofId:'photo',lines:[{serviceId:ids[0],weight:3}],reason:'Pisahkan bed cover untuk pengambilan berikutnya.'});
 assert.equal(o.price.total,18000);assert.equal(o.price.revision,2);assert.equal(o.priceHistory[0].price.total,115000);
 assert.equal(o.priceHistory[0].by,operator.id);assert.equal(o.priceApproved,false);assert.equal(o.priceApproval,undefined);
 assert.equal(o.pay.attempts[0].status,'VOIDED');assert.equal(o.pay.proof,undefined);assert.equal(o.pay.submittedBy,undefined);assert.equal(o.status,'PRICE CONFIRMATION PENDING');
});
test('received money and processing prevent silent price rewrites',()=>{
 let o=act(weighed(),'approve-price',{},customer);o=act(o,'create-pay',{method:'Cash'});o=act(o,'verify-pay',{proofId:'photo',amount:1000});
 assert.throws(()=>act(o,'weigh',{proofId:'photo',lines}));
 const working=act(weighed(),'process',exception(weighed()));assert.throws(()=>act(working,'weigh',{proofId:'photo',lines}));
});
test('proceeding without approval needs a deliberate flag, meaningful reason and known context',()=>{
 const o=weighed(),valid=exception(o);
 for(const bad of [{proceedWithoutApproval:false},{reason:'Lanjut'},{overrideContext:'anything'}])assert.throws(()=>act(o,'process',{...valid,...bad}));
 for(const role of ['Finance','Customer'])assert.throws(()=>act(o,'process',valid,{id:'x',role}));
 assert.equal(o.status,'PRICE CONFIRMATION PENDING');assert.equal(o.exceptions.filter(e=>e.type==='PROCESS WITHOUT CUSTOMER APPROVAL').length,0);
});
test('override never bypasses identity, latest revision, labels, scan or Owner paid policy',()=>{
 const o=weighed();
 for(const bad of [{identity:'PENDING'},{acceptedRevision:0},{label:false},{custody:false}])assert.throws(()=>act({...o,...bad},'process',exception(o)));
 assert.throws(()=>act(o,'process',{...exception(o),scannedId:'different'}));
 const strict=act(o,'set-process-policy',{required:true},owner);assert.throws(()=>act(strict,'process',exception(strict)));
});
test('operator exception is audited and permits work while customer approval stays pending',()=>{
 let o=weighed();o.price.at=new Date(Date.now()-3*3600000).toISOString();o=act(o,'process',exception(o));
 assert.equal(o.status,'IN PROCESS');assert.equal(o.priceApproved,false);assert.equal(o.processAuthorization.by,operator.id);
 assert.equal(o.processAuthorization.priceRevision,1);assert(o.processAuthorization.waitMinutes>=180);
 const incident=o.exceptions.find(e=>e.type==='PROCESS WITHOUT CUSTOMER APPROVAL');assert(incident.open);
 assert.throws(()=>act(o,'create-pay',{method:'Cash'}));assert.throws(()=>act(o,'resolve-exception',{exceptionId:incident.id,proofId:'photo',reason:'Coba tutup sebelum persetujuan'},owner));
 o=act(o,'ready',{proofId:'photo'});o=act(o,'paylater',{reason:'Owner mengizinkan bayar nanti'},owner);
 assert.throws(()=>act(o,'handover',{proofId:'photo',recipient:'Pelanggan Uji'}));
 o=act(o,'approve-price',{},customer);assert.equal(o.status,'READY FOR HANDOVER');assert(o.priceApproved);
 assert.equal(o.priceApproval.via,'CUSTOMER PORTAL');assert.equal(o.exceptions.find(e=>e.id===incident.id).open,false);
 assert.equal(act(o,'handover',{proofId:'photo',recipient:'Pelanggan Uji'}).status,'COMPLETED');
});
test('revisions preserve package arrays and require operator to accept the new selection',()=>{
 let o=weighed();o=act(o,'revise',{...p,serviceIds:[ids[1]]},customer);
 assert.deepEqual(o.customer.serviceIds,[ids[1]]);assert.equal(o.priceApproved,false);
 assert.throws(()=>act(o,'weigh',{proofId:'photo',lines:[{serviceId:ids[1],quantity:1}]}));
 o=act(o,'accept');assert.equal(act(o,'weigh',{proofId:'photo',lines:[{serviceId:ids[1],quantity:1}]}).price.total,35000);
});
