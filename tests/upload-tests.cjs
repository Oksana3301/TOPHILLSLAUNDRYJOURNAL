const test=require('node:test'),assert=require('node:assert/strict');
const Upload=require('../dist/upload.js');
let sent=[];
class XHR{constructor(){this.upload={};this.headers={};sent.push(this)}open(method,url){this.method=method;this.url=url}setRequestHeader(k,v){this.headers[k]=v}send(body){this.body=body}}
global.XMLHttpRequest=XHR;
const data=()=>{const form=new FormData();form.set('file',new File(['example'],'proof.pdf',{type:'application/pdf'}));return form};
test('original document is transferred once; progress never confirms durable storage',async()=>{
 sent=[];const form=data(),progress=[];let resolved=false;
 const pending=Upload.send('/api/proof',form,{headers:{'X-Top-Hills':'1'},onProgress:n=>progress.push(n)}).then(v=>{resolved=true;return v});
 const xhr=sent[0];assert.equal(xhr.body,form);assert.equal(xhr.withCredentials,true);assert.equal(xhr.headers['X-Top-Hills'],'1');assert.equal(xhr.timeout,120000);
 xhr.upload.onprogress({lengthComputable:true,loaded:7,total:7});await Promise.resolve();assert.equal(resolved,false);assert.deepEqual(progress,[0,100]);assert.match(Upload.progress(100),/Menunggu/);
 xhr.status=200;xhr.responseText=JSON.stringify({id:'confirmed'});xhr.onload();assert.deepEqual(await pending,{id:'confirmed'});assert.equal(sent.length,1);
});
test('rejects oversize and missing evidence before transfer; handles server denial and uncertain timeout',async()=>{
 sent=[];await assert.rejects(Upload.send('/api/proof',new FormData()),/Pilih file/);await assert.rejects(Upload.send('/api/proof',data(),{maxBytes:1}),/terlalu besar/);assert.equal(sent.length,0);
 let pending=Upload.send('/api/proof',data());sent.at(-1).status=403;sent.at(-1).responseText='{"error":"Akses dibatasi."}';sent.at(-1).onload();await assert.rejects(pending,e=>e.httpStatus===403);
 pending=Upload.send('/api/proof',data());sent.at(-1).ontimeout();await assert.rejects(pending,/Periksa daftar bukti/);assert.equal(sent.length,2);
});
test('camera output is bounded without upscaling or changing aspect ratio',()=>{
 assert.deepEqual(Upload.dimensions(4032,3024),{width:1920,height:1440});assert.deepEqual(Upload.dimensions(3024,4032),{width:1440,height:1920});assert.deepEqual(Upload.dimensions(640,480),{width:640,height:480});
});
