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
 vm.createContext(context);for(const f of ['copy.js','laundry-labels.js','services-core.js','laundry-ui.js','laundry-scenarios.js','laundry-guide.js','laundry-guide-ui.js','upload.js'])vm.runInContext(readFileSync('dist/'+f,'utf8'),context);
 vm.runInContext(readFileSync('dist/laundry-desk.js','utf8').replace(";load();",";"),context);
 const member={id:'owner-test',name:'Petugas contoh',role:'Owner'},room={id:'A01',building:'A',floor:'1',roomType:'Kost',type:'Kost'};
 const order=newOrder({id:'THL-TEST',room,p:{name:'Contoh',contact:'0800000000',method:'dropoff',serviceId:'THL-regular-refresh'},actor:member});order.alerts=alerts(order);order.clear=clearState(order);
 const data={order,proofs:[],events:[],accounting:{status:'Belum ada kejadian keuangan',expected:0,posted:0}};context.fixture={member,data};context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>structuredClone(data)}};
 vm.runInContext('member=fixture.member;selected=fixture.data.order.id;detail=fixture.data;',context);
 return {context,data,nodes,get,timers,calls,run:s=>vm.runInContext(s,context)};
}
test('one work area, collapsed supporting sections, original 28 scenario guidance retained',async()=>{
 const h=setup();await h.run('openOrder(selected)');const html=h.get('#view').innerHTML;
 assert.equal((html.match(/class="card work-now"/g)||[]).length,1);assert(!html.includes('<aside'));assert(html.includes('KERJAKAN SEKARANG'));assert(html.includes('Wajib pada tahap ini'));
 assert.match(html,/<details class="card guide-checklist">/);assert.match(html,/<details class="card scenario-library">/);assert.equal((html.match(/class="scenario-card"/g)||[]).length,28);assert(!html.includes('data-guide-action='));
 const before=html;await h.run('openOrder(selected,true)');assert.equal(h.get('#view').innerHTML,before);
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
