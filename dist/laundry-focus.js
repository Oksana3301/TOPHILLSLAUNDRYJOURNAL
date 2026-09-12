(function(root){'use strict';
const terminal=o=>['COMPLETED','CANCELLED','VOIDED','LINKED'].includes(o.status);
const openIssues=o=>(o.exceptions||[]).filter(e=>e.open);
function needsReturnProof(o){return o.status==='CANCELLED'&&!o.custody&&!o.returnProof&&!!o.intakeProof&&openIssues(o).some(e=>['LABEL MISSING','RELABEL REQUIRED','OWNERSHIP REJECTED'].includes(e.type));}
function focus(o,role,actions=[]){
 const has=a=>actions.includes(a),choose=list=>list.find(has)||null;
 const item=(title,text,action=null,tone='info',waitingFor='')=>({title,text,action,tone,waitingFor,complete:false,link:null});
 const financial=()=>choose(['refund-approve','refund-pay','refund-account','refund-reconcile','verify-pay','payment-proof','create-pay','submit-set','approve-set'].filter(a=>a!=='payment-proof'||o.pay.method==='Cash'||o.pay.status!=='PENDING VERIFICATION'||!o.pay.proof));
 const money=action=>item(({ 'refund-approve':'Periksa permintaan pengembalian dana','refund-pay':'Kembalikan dana pelanggan','refund-account':'Lengkapi asal dana pengembalian','refund-reconcile':'Cocokkan dana yang dikembalikan','payment-proof':'Catat bukti pembayaran','verify-pay':'Periksa pembayaran yang diterima','create-pay':'Siapkan tagihan pelanggan','submit-set':'Ajukan setoran untuk diperiksa','approve-set':'Cocokkan setoran yang masuk'})[action],'Isi bukti dan rincian yang diminta pada langkah ini.',action,'warning');
 if(o.kind==='INT'&&o.status==='LINKED')return {...item('Pencatatan barang sudah selesai','Lanjutkan pemeriksaan pada pesanan yang terhubung. Catatan awal tetap tersimpan.',null,'success'),complete:true,link:o.linkedThl};
 const issues=openIssues(o);
 if(needsReturnProof(o))return item('Lengkapi bukti pengembalian','Pesanan sudah dibatalkan. Owner perlu mencatat bukti barang telah dikembalikan sebelum catatan kendala dapat ditutup.',has('record-return-proof')?'record-return-proof':null,'warning',role==='Owner'?'':'Owner');
 if(o.status==='CANCEL REQUESTED')return item('Periksa permintaan pembatalan','Pastikan posisi barang dan biaya yang sudah terjadi.',has('approve-cancel')?'approve-cancel':null,'warning',has('approve-cancel')?'':'Owner');
 if(o.status==='RETURN REQUESTED')return item('Kembalikan barang pelanggan','Catat nama penerima dan bukti saat barang diserahkan kembali.',has('return')?'return':null,'warning',has('return')?'':'Operator');
 if(terminal(o)){
  if(o.custody)return item('Posisi barang perlu diperiksa','Catatan masih menunjukkan barang berada pada petugas. Minta Owner memeriksa sebelum menutup pesanan.',null,'danger','Owner');
  const a=financial();if(a)return money(a);
  if(issues.length)return item('Selesaikan '+issues.length+' catatan kendala','Periksa kejadian yang masih terbuka, lalu simpan bukti dan alasan penyelesaiannya.',has('resolve-exception')?'resolve-exception':null,'warning',has('resolve-exception')?'':'Owner');
  if(['CLEAR','CANCELLED CLEAR'].includes(o.clear)||o.status==='VOIDED'&&!o.pay.received)return {...item(o.status==='COMPLETED'?'Pesanan sudah selesai':'Pesanan sudah ditutup','Tidak ada langkah yang perlu diisi. Riwayat tetap dapat dilihat.',null,'success'),complete:true};
  return item('Menunggu pemeriksaan dana','Barang sudah selesai ditangani. Pembayaran atau setoran masih perlu diperiksa oleh petugas yang berwenang.',null,'warning',role==='Operator'?'Owner / Finance':'Petugas terkait');
 }
 if(o.kind==='INT'){
  const a=choose(['receive','relabel']);if((!o.intakeProof||!o.label)&&a)return item('Catat barang yang diterima','Ambil foto langsung, hitung kantong, pasang label, dan isi lokasi penyimpanan.',a);
  return item('Pastikan pemilik dan kamar','Barang tetap disimpan terpisah sampai pemilik serta kamar terkonfirmasi.',role==='Owner'?'link-int':null,'warning',role==='Owner'?'':'Owner');
 }
 if(role==='Finance'){const a=financial();return a?money(a):item('Belum ada tindakan keuangan','Petugas laundry melanjutkan penanganan barang. Rincian tersedia untuk diperiksa.',null,'info','Operator');}
 if(o.status==='ON HOLD'){if(!o.label&&has('relabel'))return item('Pasang label yang benar','Barang masih ditahan. Foto label pengganti sebelum melanjutkan.','relabel','danger');return item('Periksa kesiapan melanjutkan','Pastikan penyebab penundaan sudah ditangani, lalu catat alasannya. Kendala lain yang masih terbuka tetap perlu diselesaikan.',has('resume')?'resume':null,'warning');}
 if(has('accept'))return item('Periksa dan terima pesanan','Cocokkan pelanggan, kamar, layanan, dan instruksi terbaru.','accept');
 if(has('receive'))return item('Catat penerimaan barang','Ambil foto langsung, hitung kantong, lalu pasang label.','receive');
 if(has('relabel'))return item('Pasang label yang benar','Foto label pesanan bersama barang agar tidak tertukar.','relabel','warning');
 if(has('confirm-identity'))return item('Pastikan identitas pelanggan','Cocokkan nama dan kamar dengan bukti yang sah.','confirm-identity','warning');
 if(has('weigh')&&!o.price)return item('Timbang dan pilih layanan','Isi berat atau jumlah tiap paket. Foto angka timbangan dan label wajib disertakan.','weigh');
 if(o.identity!=='CONFIRMED')return item('Menunggu konfirmasi pemilik','Barang belum boleh dicuci atau ditagihkan. Owner perlu memeriksa identitasnya.',null,'warning','Owner');
 if(o.status==='IN PROCESS'&&has('ready'))return item('Periksa hasil cucian','Pastikan bersih, lengkap, dan sesuai label. Simpan foto hasilnya.','ready');
 if(!o.priceApproved&&has('approve-price'))return item('Catat persetujuan harga','Simpan bukti bahwa pelanggan menyetujui rincian layanan dan totalnya.','approve-price','warning');
 if(o.status==='READY FOR HANDOVER'&&has('handover'))return item('Serahkan kepada pelanggan','Catat nama penerima dan bukti serah terima.','handover');
 if(o.status==='READY FOR HANDOVER'||o.requirePaidBeforeProcess&&o.pay.status!=='PAID'){const a=financial();return a?money(a):item('Menunggu pemeriksaan pembayaran','Pembayaran perlu diselesaikan oleh petugas yang berwenang.',null,'warning','Owner / Finance');}
 if(has('process'))return item('Mulai pengerjaan laundry','Cocokkan label dan isi mesin atau kelompok cucian yang digunakan.','process');
 const a=financial();if(a)return money(a);
 return item('Menunggu langkah berikutnya','Periksa rincian pesanan atau hubungi penanggung jawab.','','info','Petugas terkait');
}
const api={focus,needsReturnProof,openIssues,terminal};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.THLaundryFocus=api;
})(typeof window!=='undefined'?window:globalThis);
