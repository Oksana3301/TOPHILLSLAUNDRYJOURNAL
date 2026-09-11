(function(root){'use strict';
// A response confirms storage; transfer completion alone never means saved.
function send(url,form,{headers={},onProgress=()=>{},maxBytes=5000000}={}){
 const file=form.get('file');
 if(!file||!file.size)return Promise.reject(Error('Pilih file bukti terlebih dahulu.'));
 if(file.size>maxBytes)return Promise.reject(Error('File terlalu besar. Pilih file maksimal '+(maxBytes/1000000)+' MB.'));
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('POST',url);xhr.withCredentials=true;xhr.timeout=120000;
  for(const [key,value] of Object.entries(headers))xhr.setRequestHeader(key,value);
  xhr.upload.onprogress=e=>onProgress(e.lengthComputable?Math.min(100,Math.round(e.loaded/e.total*100)):null);
  xhr.onload=()=>{let value;try{value=JSON.parse(xhr.responseText)}catch{return reject(Error('Hasil unggahan belum dapat dibaca. Periksa daftar bukti sebelum mengirim ulang.'))}
   if(xhr.status>=200&&xhr.status<300)resolve(value);
   else reject(Object.assign(Error(root.THCopy?.error(value.error||'Bukti belum tersimpan.')||value.error||'Bukti belum tersimpan.'),{httpStatus:xhr.status}));};
  xhr.onerror=xhr.ontimeout=xhr.onabort=()=>reject(Error('Koneksi terputus atau terlalu lambat. Periksa daftar bukti sebelum mengirim ulang.'));
  onProgress(0);xhr.send(form);
 });
}
function progress(value){return value===100?'Unggahan terkirim. Menunggu bukti tersimpan…':value===null?'Mengunggah bukti…':'Mengunggah bukti · '+value+'%';}
function dimensions(width,height){const scale=Math.min(1,1920/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
const api={send,progress,dimensions};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.THUpload=api;
})(typeof window!=='undefined'?window:globalThis);
