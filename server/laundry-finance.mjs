// Source events create reviewable proposals. Posting and formal report gates stay independent.
import F from '../dist/finance-core.js';
export function laundryCandidates(o){
 if(o.simulation||o.kind==='INT'||o.status==='LINKED')return [];
 const out=[],date=v=>F.dateOf(v,'Asia/Jakarta');
 if(o.status==='COMPLETED'&&o.handoverProof&&o.price)out.push({suffix:'service',kind:'service',date:date(o.handover.at),description:o.id+' · '+(o.price.lines?.map(x=>x.service.name).join(' + ')||o.price.service?.name||'Laundry'),amount:o.price.total,account:'4101',proof:o.handoverProof,sourceActor:o.handover.by,sourceAt:o.handover.at});
 for(const a of (o.pay.attempts||[]).filter(a=>a.received))out.push({suffix:a.id,kind:'receipt',date:date(a.receivedAt),description:'Penerimaan '+o.id,amount:a.received,method:a.method,cashAccount:a.method==='Cash'?'1101':'1102',reference:a.reference||o.pay.receiptNo||a.id,proof:a.proof,sourceActor:a.receivedBy,sourceAt:a.receivedAt});
 const settlements=[...new Map([...(o.set.history||[]),o.set].filter(x=>x.status==='MATCHED'&&x.approvedAt).map(x=>[x.approvedAt,x])).values()].sort((a,b)=>a.approvedAt.localeCompare(b.approvedAt));
 let priorGross=0,priorFee=0;
 for(const [index,settlement] of settlements.entries()){
  const fee=Number(settlement.fee||0),gross=Number(settlement.actual||0)+fee,delta=gross-priorGross,deltaFee=fee-priorFee,suffix=index?'-'+(index+1):'';
  if(o.pay.method==='Cash'&&delta>0)out.push({suffix:'settlement'+suffix,kind:'transfer',date:date(settlement.approvedAt),description:'Setoran '+settlement.id+suffix,amount:delta,cashAccount:'1101',toAccount:'1102',reference:settlement.reference,proof:settlement.proof,sourceActor:settlement.submittedBy,sourceAt:settlement.approvedAt});
  if(deltaFee>0)out.push({suffix:'settlement-fee'+suffix,kind:'expense',date:date(settlement.approvedAt),description:'Biaya setoran '+settlement.id+suffix,amount:deltaFee,account:'5105',cashAccount:'1102',paid:true,vendor:settlement.account,invoiceNo:settlement.reference,reference:settlement.reference,proof:settlement.proof,sourceActor:settlement.submittedBy,sourceAt:settlement.approvedAt});
  priorGross=gross;priorFee=fee;
 }
 for(const [i,p] of (o.ref.payments||[]).entries())out.push({suffix:'refund-'+(i+1),kind:'refund',refundType:'deposit',date:date(p.at),description:'Pengembalian uang muka '+o.id,amount:p.amount,cashAccount:p.cashAccount,reference:p.reference,reason:o.ref.reason,proof:p.proof,sourceActor:p.by,sourceAt:p.at,holdReason:!p.cashAccount?'Rekening asal refund belum tercatat. Lengkapi dari order sumber.':''});
 return out.sort((a,b)=>a.date.localeCompare(b.date)||({receipt:0,service:1,transfer:2,expense:3,refund:4}[a.kind]-{receipt:0,service:1,transfer:2,expense:3,refund:4}[b.kind]));
}
export async function importLaundryFinance(env,w,m){
 const rows=(await env.DB.prepare("SELECT data FROM laundry_orders WHERE COALESCE(json_extract(data,'$.simulation'),0)=0 AND (status='COMPLETED' OR COALESCE(json_extract(data,'$.pay.received'),0)>0) ORDER BY created_at,id").all()).results;let added=0;
 const known=new Map(w.finance.transactions.map(t=>[t.sourceKey,t])),orders=rows.map(row=>JSON.parse(row.data)),proofKeys=new Map();
 for(const o of orders)for(const c of laundryCandidates(o))if(c.proof&&!known.has('portal:'+o.id+':'+c.suffix))proofKeys.set(JSON.stringify([o.id,c.proof]),[o.id,c.proof]);
 const keys=[...proofKeys.keys()],proofResults=keys.length?await env.DB.batch([...proofKeys.values()].map(([orderId,proofId])=>env.DB.prepare('SELECT * FROM laundry_proofs WHERE id=? AND order_id=?').bind(proofId,orderId))):[],proofs=new Map(keys.map((key,i)=>[key,proofResults[i].results[0]]));
 for(const o of orders){const base={sourceType:'portal',unit:'laundry',customer:'portal:'+o.id,customerName:o.customer.name,orderId:o.id,createdBy:m.id,createdAt:new Date().toISOString(),status:'Diajukan',fixture:false};
  for(const c of laundryCandidates(o)){const key='portal:'+o.id+':'+c.suffix;const existing=known.get(key);if(existing){if(c.kind==='refund'&&c.cashAccount&&!existing.cashAccount&&!['Tercatat','Direversal'].includes(existing.status)){existing.cashAccount=c.cashAccount;existing.holdReason='';existing.status='Diajukan';existing.sourceUpdatedAt=o.updatedAt;added++;}continue;}
   const proof=c.proof?proofs.get(JSON.stringify([o.id,c.proof])):null;
   const t={...base,...c,id:'PORTAL-'+c.suffix+'-'+o.id,sourceKey:key,portalManaged:true,createdBy:c.sourceActor||m.id};delete t.proof;delete t.suffix;
   if(t.kind==='service'&&w.finance.policies?.approved===false)t.holdReason='Kebijakan pengakuan belum disetujui.';
   if(t.holdReason)t.status='Tertahan';w.finance.transactions.push(t);known.set(key,t);
   if(proof)w.finance.attachments.push({id:'PORTAL-PROOF-'+t.id,objectId:t.id,key:proof.object_key,name:'Bukti-'+o.id+'.'+(proof.mime==='application/pdf'?'pdf':proof.mime==='image/png'?'png':'jpg'),mime:proof.mime,size:0,hash:'',createdBy:proof.actor,createdAt:proof.created_at,version:1});added++;
  }
 }
 return added;
}
export async function validateLaundryPosting(env,t,s){
 if(!t.portalManaged)return validateManualDeskSources(env,t);
 const row=await env.DB.prepare('SELECT data FROM laundry_orders WHERE id=?').bind(t.orderId).first(),o=row&&JSON.parse(row.data),c=o&&laundryCandidates(o).find(c=>'portal:'+o.id+':'+c.suffix===t.sourceKey);
 const fail=message=>{throw Object.assign(new Error(message),{status:400});};
 if(!c||c.amount!==t.amount||c.date!==t.date||c.kind!==t.kind||c.cashAccount!==t.cashAccount)fail('Order sumber berubah. Rekonsiliasi nilai dari meja laundry sebelum mencatat.');
 if(c.holdReason)fail(c.holdReason);
 if(t.kind==='service'&&!s.policies.approved)fail('Sahkan kebijakan pengakuan dahulu.');
 if(t.kind==='refund'&&!['1102','1101K'].includes(c.cashAccount))fail('Periksa rekening sumber refund.');
}

export async function validateLaundryFinal(env,s,f){
 if(f.unit&&f.unit!=='laundry')return;
 const fail=message=>{throw Object.assign(new Error('Belum dapat Final: '+message),{status:400});};
 const rows=(await env.DB.prepare("SELECT data FROM laundry_orders WHERE COALESCE(json_extract(data,'$.simulation'),0)=0").all()).results;
 const expectedKeys=new Set(rows.flatMap(row=>{const o=JSON.parse(row.data);return laundryCandidates(o).map(c=>'portal:'+o.id+':'+c.suffix);}));
 for(const t of s.transactions.filter(t=>t.portalManaged&&t.status==='Tercatat'&&t.date<=f.end))if(!expectedKeys.has(t.sourceKey))fail('Jurnal '+t.id+' tidak lagi cocok dengan order sumber; periksa koreksinya.');
 for(const row of rows){const o=JSON.parse(row.data),cs=laundryCandidates(o).filter(c=>c.date<=f.end);if(!cs.length)continue;
  for(const c of cs){const t=s.transactions.find(t=>t.sourceKey==='portal:'+o.id+':'+c.suffix);if(!t||t.status!=='Tercatat')fail(o.id+' masih memiliki kejadian keuangan yang belum dibukukan.');await validateLaundryPosting(env,t,s);}
  const received=(o.pay.attempts||[]).filter(a=>a.received&&F.dateOf(a.receivedAt,'Asia/Jakarta')<=f.end).reduce((n,a)=>n+a.received,0);const matched=[...(o.set.history||[]),o.set].filter(x=>x.status==='MATCHED'&&x.approvedAt);const matchedGross=Math.max(0,...matched.map(x=>x.gross||0));const adjustment=o.ref.settlementAdjustment;const returned=adjustment?.status==='MATCHED'?adjustment.cashReturned||0:0;if(received>matchedGross+returned)fail(o.id+' masih menunggu pencocokan setoran untuk periode ini.');
  const requested=o.ref.requestedAt||o.ref.payments?.[0]?.at||o.updatedAt;if(o.ref.amount&&requested&&F.dateOf(requested,'Asia/Jakarta')<=f.end&&(o.ref.status!=='REFUNDED'||adjustment?.status!=='MATCHED'))fail(o.id+' masih memiliki refund yang belum selesai dicocokkan untuk periode ini.');
 }
}

export async function validateManualDeskSources(env,t){
 if(t.portalManaged||!['receipt','service','refund'].includes(t.kind))return;
 const ids=[...new Set([t.orderId,...(Array.isArray(t.allocations)?t.allocations.map(a=>a.orderId):[])].filter(Boolean))];
 if(!ids.length)return;
 if(ids.length>100)throw Object.assign(new Error('Maksimal 100 alokasi per transaksi.'),{status:400});
 const source=await env.DB.prepare('SELECT id FROM laundry_orders WHERE id IN ('+ids.map(()=>'?').join(',')+') LIMIT 1').bind(...ids).first();
 if(source)throw Object.assign(new Error('Catat kejadian barang atau uang melalui meja laundry. Usulan pembukuan dibuat dari sumber yang sama.'),{status:400});
}
