(function(root){
'use strict';
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value||0);
const S=()=>root.THServices;
const ids=c=>c?.serviceIds||[c?.serviceId].filter(Boolean);
const icon=tone=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tone==='success'?'<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>':tone==='danger'?'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'}</svg>`;
function tone(value){
 if(['PAID','MATCHED','CONFIRMED','CLEAR','CANCELLED CLEAR','COMPLETED','READY FOR HANDOVER','REFUNDED','REFUND ADJUSTED','APPROVED'].includes(value))return 'success';
 if(['QUARANTINE','ON HOLD','UNIDENTIFIED','SHORT','OVER','UNDERPAID','OVERPAID','EXPIRED','CANCELLED','VOIDED','REQUIRES RECONCILIATION','PARTIALLY REFUNDED'].includes(value))return 'danger';
 if(['PENDING','PENDING VERIFICATION','PRICE CONFIRMATION PENDING','IN TRANSIT','REQUESTED','CANCEL REQUESTED','RETURN REQUESTED','OPEN'].includes(value))return 'warning';
 return 'info';
}
function badge(value,label){const t=tone(value);return `<span class="status-badge ${t}">${icon(t)}<span>${E(label||root.THLaundryLabel(value))}</span></span>`;}
const alertNames={'PROCESS WITHOUT CUSTOMER APPROVAL':'Diproses tanpa konfirmasi pelanggan','INTAKE >5 MINUTES':'Penerimaan dicatat terlambat','LABEL MISSING':'Label barang hilang','RELABEL REQUIRED':'Label pengganti diperlukan','OWNERSHIP REJECTED':'Kepemilikan barang ditolak','OVERPAYMENT':'Pembayaran berlebih','SET SHORT':'Setoran kurang','SET OVER':'Setoran berlebih','ON HOLD':'Order ditahan'};
function alert(text){return `<div class="alert danger">${icon('danger')}<span>${E(alertNames[text]||text)}</span></div>`;}
function picker(services,c={}){
 const chosen=ids(c),groups=[...new Set(['Kiloan & cepat','Setrika',...services.map(s=>s.category)])];
 return `<fieldset class="service-picker full"><legend>Pilih paket laundry</legend><p class="muted">Boleh lebih dari satu paket. Berat dan jumlah tiap paket dicatat oleh petugas.</p><p class="selection-count" data-service-count>${chosen.length} paket dipilih</p>${groups.map((group,i)=>`<details class="service-group" ${i===0||services.some(s=>s.category===group&&chosen.includes(s.id))?'open':''}><summary>${E(group)}</summary><div class="package-grid">${services.filter(s=>s.category===group).map(s=>`<label class="package-option"><input type="checkbox" name="serviceIds" value="${E(s.id)}" ${chosen.includes(s.id)?'checked':''}><span><strong>${E(s.name)}</strong><span class="package-rate">${money(s.price)} / ${E(s.unit)}</span><small>${E(S().duration(s))} · ${E(S().rule(s))}</small></span></label>`).join('')}</div></details>`).join('')}</fieldset>`;
}
function bindPicker(form){
 if(!form)return;
 const update=()=>{const checked=form.querySelectorAll('[name=serviceIds]:checked');const count=form.querySelector('[data-service-count]');if(count)count.textContent=checked.length+' paket dipilih';};
 form.addEventListener('change',update);update();
}
function serialize(form,allowEmpty=false){
 const f=new FormData(form),data=Object.fromEntries(f);
 if(form.querySelector('[name=serviceIds]')){
  data.serviceIds=f.getAll('serviceIds');data.serviceId=data.serviceIds[0]||'';
  if(!data.serviceIds.length&&!allowEmpty)throw Error('Pilih minimal satu paket laundry.');
 }
 if(form.querySelector('[data-weigh-lines]')){
  data.lines=[...form.querySelectorAll('[data-price-line]')].filter(row=>row.querySelector('[data-line-enabled]').checked).map(row=>({serviceId:row.dataset.priceLine,weight:Number(row.querySelector('[data-weight]')?.value||0),quantity:Number(row.querySelector('[data-quantity]')?.value||0)}));
  if(!data.lines.length)throw Error('Pilih minimal satu paket untuk ditimbang.');
 }
 return data;
}
function priceLines(price){return price?.lines?.length?price.lines:price?[price]:[];}
function priceTable(price){
 if(!price)return '<p class="muted">Rincian harga muncul setelah petugas menimbang barang.</p>';
 return `<div class="receipt-lines">${priceLines(price).map(l=>`<div class="receipt-line"><span><strong>${E(l.service.name)}</strong><small>${l.billedQuantity} ${E(l.service.unit)}${l.service.unit==='Load'?' · '+l.weight+' kg':''} × ${money(l.service.price)}</small></span><strong>${money(l.total)}</strong></div>`).join('')}<div class="receipt-total"><span>Total laundry</span><strong>${money(price.total)}</strong></div></div>`;
}
function weighRow(service,line={}){
 const weighted=S().weighted(service),measure=weighted?'Berat (kg)':'Jumlah ('+service.unit+')',value=weighted?(line.weight||''):(line.quantity||'');
 return `<div class="weigh-line" data-price-line="${E(service.id)}"><label class="check"><input type="checkbox" data-line-enabled checked><strong>${E(service.name)}</strong></label><small>${money(service.price)} / ${E(service.unit)} · ${E(S().rule(service))}</small><div class="weigh-measure"><label>${E(measure)}<input name="${weighted?'weight':'quantity'}-${E(service.id)}" ${weighted?'data-weight':'data-quantity'} type="number" min="${weighted?'0.01':'1'}" step="${weighted?'0.01':'1'}" max="1000" required value="${E(value)}" inputmode="${weighted?'decimal':'numeric'}"></label><div class="line-quote" aria-live="polite"></div></div></div>`;
}
function weighEditor(o){
 const lines=priceLines(o.price),chosen=lines.length?lines.map(l=>l.service.id):ids(o.customer),catalog=S().catalog();
 return `<div class="full"><p class="alert info">Timbang setiap paket secara terpisah. Jangan menghitung pakaian yang sama dalam dua paket.</p><div data-weigh-lines>${chosen.map(id=>weighRow(catalog.find(s=>s.id===id),lines.find(l=>l.service.id===id))).join('')}</div><div class="add-package"><label>Tambah paket lain<select data-add-service><option value="">Pilih paket tambahan</option>${catalog.map(s=>`<option value="${E(s.id)}">${E(s.name)}</option>`).join('')}</select></label><button type="button" data-add-line>Tambah paket</button></div><div data-weigh-total class="quote-total" aria-live="polite"></div></div>${o.price?'<label class="full">Catatan koreksi (opsional)<textarea name="reason" maxlength="1000" placeholder="Contoh: selimut dipisahkan dari pakaian kiloan."></textarea></label>':''}`;
}
function bindWeigh(form){
 if(!form?.querySelector('[data-weigh-lines]'))return;
 const refresh=()=>{
  let total=0,valid=true,count=0;
  form.querySelectorAll('[data-price-line]').forEach(row=>{
   const checked=row.querySelector('[data-line-enabled]').checked,input=row.querySelector('[data-weight],[data-quantity]'),out=row.querySelector('.line-quote');input.disabled=!checked;row.classList.toggle('unchecked',!checked);
   if(!checked){out.textContent='Paket tidak ikut dikerjakan';return;}count++;
   const service=S().catalog().find(s=>s.id===row.dataset.priceLine);
   try{const q=S().quote(service,Number(row.querySelector('[data-weight]')?.value||0),Number(row.querySelector('[data-quantity]')?.value||0));if(!q.total||!q.minimumMet)throw Error('Lengkapi jumlah. '+S().rule(service));out.className='line-quote success';out.textContent=q.billedQuantity+' '+service.unit+' · '+money(q.total);total+=q.total;}catch(e){valid=false;out.className='line-quote danger';out.textContent=e.message;}
  });
  const out=form.querySelector('[data-weigh-total]');out.innerHTML=`<span>${count} paket${valid&&count?' · siap disimpan':' · rincian belum lengkap'}</span><strong>${money(total)}</strong>`;
 };
 form.querySelector('[data-add-line]').onclick=()=>{const select=form.querySelector('[data-add-service]'),service=S().catalog().find(s=>s.id===select.value);if(!service)return;const existing=[...form.querySelectorAll('[data-price-line]')].find(r=>r.dataset.priceLine===service.id);if(existing)existing.querySelector('[data-line-enabled]').checked=true;else form.querySelector('[data-weigh-lines]').insertAdjacentHTML('beforeend',weighRow(service));select.value='';refresh();};
 form.addEventListener('input',refresh);form.addEventListener('change',refresh);refresh();
}
function guidance(o){
 if(o.status==='CANCEL REQUESTED')return {title:'Pembatalan perlu diperiksa',text:'Periksa pekerjaan yang sudah berjalan dan putuskan pembatalan sebelum melanjutkan.',tone:'danger',primary:'approve-cancel'};
 if(o.status==='RETURN REQUESTED')return {title:'Kembalikan barang pelanggan',text:'Catat penerima dan bukti pengembalian. Periksa pengembalian dana bila sudah ada pembayaran.',tone:'warning',primary:'return'};
 if(o.status==='COMPLETED')return {title:o.clear==='CLEAR'?'Selesai dan sudah cocok':'Barang sudah diserahkan',text:o.clear==='CLEAR'?'Seluruh proses dan pencocokan dana selesai.':'Periksa pembayaran, setoran, atau kendala yang masih terbuka.',tone:o.clear==='CLEAR'?'success':'warning',primary:'submit-set'};
 if(['CANCELLED','VOIDED','LINKED'].includes(o.status))return {title:root.THLaundryLabel(o.status),text:'Riwayat order tetap tersimpan. Periksa pengembalian dana atau setoran bila masih terbuka.',tone:'warning'};
 if(o.status==='ON HOLD')return {title:'Order sedang ditahan',text:'Selesaikan kendala lalu lanjutkan tahap sebelumnya.',tone:'danger',primary:'resume'};
 if(o.identity==='UNIDENTIFIED'||o.kind==='INT')return {title:'Identifikasi barang terlebih dahulu',text:'Barang tetap di karantina. Owner perlu memverifikasi pemilik dan kamar.',tone:'danger'};
 if(o.acceptedRevision<o.customerRevision)return {title:'Terima pesanan atau revisi terbaru',text:'Periksa paket, kamar, dan instruksi pelanggan sebelum melanjutkan.',tone:'warning',primary:'accept'};
 if(!o.custody)return {title:'Catat penerimaan barang',text:'Ambil foto langsung, isi jumlah kantong dan lokasi, lalu pasang label.',tone:'info',primary:'receive'};
 if(!o.label)return {title:'Label perlu diperbaiki',text:'Barang tidak dapat diproses atau diserahkan tanpa label yang benar.',tone:'danger',primary:'relabel'};
 if(!o.price)return {title:'Isi hasil timbang per paket',text:'Masukkan berat kiloan dan jumlah barang satuan secara terpisah.',tone:'info',primary:'weigh'};
 if(o.identity!=='CONFIRMED')return {title:'Konfirmasi pemilik diperlukan',text:'Minta pelanggan mengonfirmasi identitas melalui tautan order atau minta verifikasi Owner.',tone:'danger',primary:'confirm-identity'};
 if(o.status==='IN PROCESS')return {title:'Laundry sedang dikerjakan',text:o.priceApproved?'Selesaikan pencucian dan pemeriksaan kualitas.':'Proses berjalan melalui pengecualian. Konfirmasi harga pelanggan masih ditunggu.',tone:o.priceApproved?'info':'warning',primary:'ready'};
 if(!o.priceApproved)return {title:'Menunggu konfirmasi harga',text:'Pelanggan dapat menyetujui melalui tautan order. Jika belum merespons, petugas dapat melanjutkan proses dengan alasan tercatat.',tone:'warning',primary:'approve-price'};
 if(o.status==='READY FOR HANDOVER')return {title:'Siap diserahkan',text:o.pay.status==='PAID'?'Pembayaran sudah lunas. Catat penerima dan bukti serah terima.':'Selesaikan pembayaran atau persetujuan bayar nanti dari Owner.',tone:o.pay.status==='PAID'?'success':'warning',primary:o.pay.status==='PAID'?'handover':'create-pay'};
 return {title:'Harga sudah disetujui',text:'Pindai label dan isi nomor mesin untuk mulai bekerja.',tone:'success',primary:'process'};
}
root.THLaundryUI={ids,picker,bindPicker,serialize,priceLines,priceTable,weighEditor,bindWeigh,tone,badge,alert,guidance,icon};
})(window);
