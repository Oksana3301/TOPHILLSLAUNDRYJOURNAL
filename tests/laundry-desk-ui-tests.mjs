import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {newOrder,alerts,clearState} from '../server/laundry-engine.mjs';
function setup(){
 const nodes=new Map();const element=()=>({innerHTML:'',textContent:'',children:[],disabled:false,open:false,addEventListener(){},append(x){this.children.push(x)},close(){this.open=false},showModal(){this.open=true}});
 const get=s=>{if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)};
 const document={hidden:false,querySelector:get,querySelectorAll:()=>[],createElement:element};
 const timers=[],calls=[];const context={document,console,URLSearchParams,FormData,File,AbortSignal,crypto,structuredClone,setTimeout,clearTimeout,setInterval:f=>timers.push(f),location:{search:'',origin:'https://local.test'},history:{replaceState(){}},navigator:{onLine:true},addEventListener(){}};context.window=context;
 vm.createContext(context);for(const f of ['copy.js','laundry-labels.js','services-core.js','laundry-ui.js','laundry-scenarios.js','laundry-guide.js','laundry-guide-ui.js','laundry-focus.js','upload.js'])vm.runInContext(readFileSync('dist/'+f,'utf8'),context);
 vm.runInContext(readFileSync('dist/laundry-desk.js','utf8').replace(";load();",";"),context);
 const member={id:'owner-test',name:'Petugas contoh',role:'Owner'},room={id:'A01',building:'A',floor:'1',roomType:'Kost',type:'Kost'};
 const order=newOrder({id:'THL-TEST',room,p:{name:'Contoh',contact:'0800000000',method:'dropoff',serviceId:'THL-regular-refresh'},actor:member});order.alerts=alerts(order);order.clear=clearState(order);
 const data={order,proofs:[],events:[],accounting:{status:'Belum ada kejadian keuangan',expected:0,posted:0}};context.fixture={member,data};context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>structuredClone(data)}};
 vm.runInContext('member=fixture.member;selected=fixture.data.order.id;detail=fixture.data;',context);
 return {context,data,nodes,get,timers,calls,run:s=>vm.runInContext(s,context)};
}
test('one current action; details, history and SOP library do not fill the order page',async()=>{
 const h=setup();await h.run('openOrder(selected)');const html=h.get('#view').innerHTML;
 assert.equal((html.match(/class="card work-now"/g)||[]).length,1);
 assert(html.includes('KERJAKAN SEKARANG'));assert(html.includes('Wajib diselesaikan'));
 assert(html.includes('Informasi saja · tidak perlu diisi'));
 assert(!html.includes('<aside'));assert(!html.includes('scenario-card'));assert(!html.includes('guide-checklist'));
 assert(!html.includes('status-grid'));assert.equal((html.match(/class="primary" data-action=/g)||[]).length,1);
 const before=html;await h.run('openOrder(selected,true)');assert.equal(h.get('#view').innerHTML,before);
});
test('linked intake points straight to its order without payments or laundry tasks',async()=>{
 const h=setup();Object.assign(h.data.order,{kind:'INT',status:'LINKED',linkedThl:'THL-NEXT',custody:false,identity:'UNIDENTIFIED'});
 await h.run('openOrder(selected)');const html=h.get('#view').innerHTML;
 assert(html.includes('Pencatatan barang sudah selesai'));assert(html.includes('/laundry-desk?order=THL-NEXT'));
 assert(!html.includes('data-action='));assert(!html.includes('Lihat laporan'));assert(!html.includes('Menunggu pemeriksaan dana'));
 h.run("showOrderInfo('details')");assert(!h.get('#modal').innerHTML.includes('id="tracking"'));
});
test('cancelled order with missing return evidence gives Owner a concrete closure path',async()=>{
 const h=setup();Object.assign(h.data.order,{status:'CANCELLED',custody:false,label:false,intakeProof:'prior-intake',returnProof:null,exceptions:[{id:'label-issue',type:'RELABEL REQUIRED',open:true}]});
 await h.run('openOrder(selected)');let html=h.get('#view').innerHTML;
 assert(html.includes('data-action="record-return-proof"'));assert(!html.includes('data-action="relabel"'));assert(!html.includes('data-action="process"'));
 h.data.order.returnProof='verified-return';await h.run('openOrder(selected)');html=h.get('#view').innerHTML;
 assert(html.includes('data-action="resolve-exception"'));assert(!html.includes('data-action="record-return-proof"'));
 h.data.order.exceptions[0].open=false;h.data.order.clear='CANCELLED CLEAR';await h.run('openOrder(selected)');
 assert(h.get('#view').innerHTML.includes('Pesanan sudah ditutup'));assert(!h.get('#view').innerHTML.includes('data-action='));
});
test('Operator waits for Owner evidence and never sees a customer tracking control',async()=>{
 const h=setup();h.run("member.role='Operator'");Object.assign(h.data.order,{status:'CANCELLED',custody:false,label:false,intakeProof:'prior-intake',returnProof:null,exceptions:[{id:'issue',type:'RELABEL REQUIRED',open:true}]});
 await h.run('openOrder(selected)');assert(h.get('#view').innerHTML.includes('MENUNGGU OWNER'));assert(!h.get('#view').innerHTML.includes('data-action="record-return-proof"'));
 h.run("showOrderInfo('details')");assert(!h.get('#modal').innerHTML.includes('id="tracking"'));
 h.run("member.role='Owner';showOrderInfo('details')");assert(h.get('#modal').innerHTML.includes('id="tracking"'));
});
test('working laundry remains the focus while customer price consent is outstanding',async()=>{
 const h=setup();Object.assign(h.data.order,{status:'IN PROCESS',custody:true,label:true,identity:'CONFIRMED',acceptedBy:{id:'worker'},acceptedRevision:1,customerRevision:1,price:{total:12000},priceApproved:false,intakeProof:'photo'});
 await h.run('openOrder(selected)');const html=h.get('#view').innerHTML;
 assert(html.includes('data-action="ready"'));assert(html.includes('Persetujuan harga pelanggan masih perlu dilengkapi'));
 assert(!html.includes('data-action="process"'));
});
test('queue uses readable cards, hides intake finances and retains access to the SOP library',()=>{
 const h=setup();Object.assign(h.data.order,{kind:'INT',status:'LINKED',linkedThl:'THL-NEXT'});
 h.run("selected=null;orders=[fixture.data.order];render()");
 const html=h.get('#view').innerHTML;assert(html.includes('class="order-card"'));assert(!html.includes('<table'));assert(html.includes('id="guide-library"'));assert(!html.includes('Setoran:'));assert(!html.includes('scenario-card'));
});
test('order information escapes customer text without introducing additional forms',()=>{
 const h=setup();h.data.order.customer.name='<script>alert(1)</script>';
 h.run("showOrderInfo('details')");const html=h.get('#modal').innerHTML;assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(!html.includes('<form'));
});
test('upload keeps the same order and performs no full reload or duplicate transfer',async()=>{
 const h=setup();let resolve,transfers=0;h.context.THUpload.send=()=>{transfers++;return new Promise(r=>resolve=r)};h.context.file=new File(['bytes'],'proof.jpg');
 const pending=h.run("upload(file,'upload')");await h.run("upload(file,'upload')");assert.equal(transfers,1);assert.equal(h.run('uploading'),true);
 resolve({id:'saved',capture:'upload',proof:{id:'saved',capture:'upload',created_at:new Date().toISOString(),mime:'image/jpeg'}});await pending;
 assert.equal(h.run('detail.proofs.length'),1);assert.equal(h.calls.length,0);assert.equal(h.run('uploading'),false);
 // A navigation already in flight must not attach the old proof to another order.
 const second=h.run("upload(file,'upload')");h.run("selected='THL-OTHER';detail={proofs:[]}");resolve({id:'other-proof',capture:'upload',proof:{id:'other-proof'}});await second;assert.equal(h.run('detail.proofs.length'),0);
});
test('upload and camera preparation pause background auto-refresh',async()=>{
 const h=setup();h.run('uploading=true');h.timers[0]();assert.equal(h.calls.length,0);h.run('uploading=false;capturing=true');h.timers[0]();assert.equal(h.calls.length,0);
});
