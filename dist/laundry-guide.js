(function(root){'use strict';
const terminal=o=>['COMPLETED','CANCELLED','VOIDED','LINKED'].includes(o.status);
// A review attests to the business state, not to another checklist click.
function reviewKey(o){return JSON.stringify([o.status,o.customerRevision,o.acceptedRevision,o.identity,o.custody,o.label,o.price?.revision,o.price?.total,o.priceApproved,o.pay?.status,o.pay?.received,o.set?.status,o.set?.actual,o.ref?.status,o.ref?.paid,o.ref?.settlementAdjustment?.status,(o.exceptions||[]).map(e=>[e.id,e.open]),o.intakeProof,o.weighProof,o.qcProof,o.handoverProof,o.returnProof,o.linkedThl]);}
function steps(o,viewerRole='Owner'){
 const out=[],cancel=['CANCEL REQUESTED','RETURN REQUESTED','CANCELLED','VOIDED'].includes(o.status),linked=o.status==='LINKED',end=terminal(o),add=(id,title,role,done,action,text,actor,skip=false)=>out.push({id,title,role,state:skip?'skip':done?'done':'pending',action,text,actor:actor?.name||actor?.actorName||'',at:actor?.at||''});
 add('record','Order tercatat','Operator',true,'','Nomor order dan sumbernya tersimpan. Semua order tampil di jurnal.',{name:o.createdName,at:o.createdAt});
 if(o.kind==='INT'&&!cancel){
  add('intake','Foto, kantong, lokasi & label barang','Operator',!!o.intakeProof&&!o.custody||!!o.intakeProof&&o.label,o.custody?'relabel':'receive','Amankan barang; catat waktu kedatangan. Barang tanpa identitas belum boleh diproses.',{name:o.receivedName,at:o.receivedAt},cancel&&!o.intakeProof);
  add('identify','Pastikan pemilik & tautkan ke pesanan','Owner',linked,'link-int','Cocokkan kamar aktif dan bukti identitas. Buka pesanan pelanggan yang sudah ditautkan untuk melanjutkan.',o.linkedBy,cancel);
 }else if(!cancel){
  add('accept','Terima order / revisi terbaru','Operator',!!o.acceptedBy&&o.acceptedRevision===o.customerRevision,'accept','Periksa nama, kamar, paket dan instruksi terbaru.',o.acceptances?.at(-1)?{name:o.acceptances.at(-1).name,at:o.acceptances.at(-1).at}:o.acceptedBy);
  add('intake','Terima barang, foto & pasang label','Operator',!!o.intakeProof&&(!o.custody||o.label),o.custody?'relabel':'receive','Foto langsung, hitung kantong, isi lokasi dan waktu tiba.',{name:o.receivedName,at:o.receivedAt});
  add('identify','Identitas pelanggan terkonfirmasi','Pelanggan / Owner',o.identity==='CONFIRMED','confirm-identity','Pelanggan mengonfirmasi melalui tautan order, atau Owner memeriksa bukti.');
  add('weigh','Timbang setiap paket','Operator',!!o.price&&!!o.weighProof,'weigh','Pisahkan berat atau jumlah setiap paket. Koreksi sebelum dibayar atau mulai dikerjakan.',o.weighedBy);
  add('price','Persetujuan harga pelanggan','Pelanggan / Operator',!!o.priceApproved,'approve-price','Catat persetujuan dengan bukti. Pengecualian mulai proses tidak menggantikan persetujuan harga.',o.priceApproval?{name:o.priceApproval.name,at:o.priceApproval.at}:null);
  add('process','Periksa label & mulai laundry','Operator',!!o.batch,'process','Isi nomor kelompok cucian pada mesin. Bila pelanggan belum merespons, catat alasan pengecualian.',o.batch?{at:o.batch.at}:null);
  add('qc','Periksa kualitas & foto hasil','Operator',!!o.qcProof,'ready','Periksa hasil cuci, jumlah barang dan label sebelum siap diserahkan.');
  add('handover','Serahkan barang dengan bukti','Operator',o.status==='COMPLETED'&&!!o.handoverProof,'handover','Nama penerima dan bukti wajib. Belum lunas memerlukan persetujuan Owner.',o.handover);
 }else{
  add('cancel','Putuskan pembatalan','Operator / Owner',['RETURN REQUESTED','CANCELLED','VOIDED'].includes(o.status),'approve-cancel',o.requiresOwner?'Sudah diproses: keputusan wajib oleh Owner.':'Simpan alasan dan periksa apakah barang atau uang sudah diterima.',o.cancelDecision);
  add('return','Kembalikan barang dengan bukti','Operator',!o.custody&&!!o.returnProof,'return','Catat penerima dan bukti pengembalian.',null,!o.intakeProof&&!o.custody);
 }
 if(!linked&&o.kind!=='INT')add('payment',cancel?'Periksa uang yang sudah diterima':'Terima & verifikasi pembayaran','Operator / Owner / Finance',cancel||o.pay.status==='PAID',['PENDING','PENDING VERIFICATION'].includes(o.pay.status)?(o.pay.method!=='Cash'&&(!o.pay.submittedBy||viewerRole==='Operator')?'payment-proof':'verify-pay'):'create-pay','Screenshot saja belum membuktikan lunas. Transfer diperiksa akun yang berbeda.',null,cancel&&!o.pay.received);
 if(o.ref.amount){
  add('refund-approval','Setujui pengembalian dana','Owner',['APPROVED','PARTIALLY REFUNDED','REFUNDED'].includes(o.ref.status),'refund-approve','Nominal dan alasan diperiksa; pembayaran awal tetap tersimpan.');
  add('refund','Kembalikan dana sampai lunas','Owner / Finance',o.ref.status==='REFUNDED','refund-pay','Catat nominal, bukti dan rekening/kas asal setiap pengembalian.');
  if(o.ref.payments?.some(p=>!p.cashAccount))add('refund-account','Lengkapi rekening pengembalian','Owner / Finance',false,'refund-account','Cocokkan rekening asal dengan bukti pengembalian yang sudah ada.');
  add('refund-match','Cocokkan dana setelah refund','Owner / Finance',o.ref.settlementAdjustment?.status==='MATCHED','refund-reconcile','Pemeriksa harus berbeda dari pengembali dana.');
 }
 if(o.pay.received){
  add('deposit','Ajukan setoran / mutasi bank','Operator / Finance',['PENDING VERIFICATION','MATCHED','REFUND ADJUSTED'].includes(o.set.status),'submit-set','Lengkapi bukti, nominal bersih, biaya dan referensi rekening.');
  add('settlement','Cocokkan setoran secara independen','Owner / Finance',['MATCHED','REFUND ADJUSTED'].includes(o.set.status),'approve-set','Pemeriksa bukan penerima uang atau pengaju setoran. Selisih tetap terbuka.');
 }
 add('exceptions','Selesaikan seluruh kendala','Owner',!(o.exceptions||[]).some(e=>e.open),'resolve-exception','Perbaiki penyebabnya, lalu simpan bukti dan alasan penyelesaian.');
 add('close','Penyelesaian order','Sistem',['CLEAR','CANCELLED CLEAR'].includes(o.clear)||linked||o.status==='VOIDED'&&!o.custody&&!o.pay.received&&!o.exceptions?.some(e=>e.open),'',linked?'Catatan barang menjadi arsip; lanjutkan pekerjaan pada pesanan pelanggan.':'Barang, pembayaran, setoran, refund dan kendala diperiksa bersama. Status keuangan dibukukan ditampilkan terpisah.');
 const payment=out.find(s=>s.id==='payment');if(payment?.state==='pending'&&!cancel){const target=out.findIndex(s=>s.id===(o.requirePaidBeforeProcess?'process':'handover'));if(target>=0){out.splice(out.indexOf(payment),1);out.splice(target,0,payment);}}
 return out.map((s,i)=>({...s,number:i+1}));
}
function related(o){const ids=new Set(['04','13','16','27']);const has=t=>(o.exceptions||[]).some(e=>e.type===t);
 if(o.createdSource==='CUSTOMER QR')for(const x of ['01','02','03'])ids.add(x);
 if(o.customerRevision>1)ids.add('05');if(o.cancelReason){ids.add(o.intakeProof?'07':'06');if(o.pay.received)ids.add('25');}
 if(o.createdSource==='OPERATOR ASSISTED')ids.add(o.kind==='INT'?'10':'08');
 if(o.identity!=='CONFIRMED')ids.add('09');else if(o.createdSource==='OPERATOR ASSISTED')ids.add('11');
 if(has('OWNERSHIP REJECTED'))ids.add('12');if(has('INTAKE >5 MINUTES')||o.createdSource==='OPERATOR ASSISTED'&&!o.intakeProof)ids.add('14');
 if(o.batch)ids.add('15');if(!o.label&&o.custody||has('LABEL MISSING')||has('RELABEL REQUIRED'))ids.add('17');
 if(o.priceHistory?.length)ids.add('18');if(o.pay.attempts?.some(a=>a.status==='EXPIRED'))ids.add('19');
 if(o.pay.method?.includes('QRIS'))ids.add('20');if(o.pay.proof||o.pay.method==='Transfer')ids.add('21');
 if(o.pay.method==='Cash')ids.add('22');if(o.pay.received)ids.add('23');if(has('SET SHORT')||has('SET OVER'))ids.add('24');
 if(o.ref.amount)ids.add('25');if(o.notification?.provider==='NOT CONNECTED')ids.add('26');if(o.room.checkout)ids.add('28');return [...ids].sort();
}
const api={steps,related,reviewKey};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.THLaundryGuide=api;
})(typeof window!=='undefined'?window:globalThis);
