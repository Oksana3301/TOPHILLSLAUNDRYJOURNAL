(function(root){'use strict';
const Copy=typeof module!=='undefined'&&module.exports?require('./copy.js'):root.THCopy;
const zone='Asia/Jakarta';
function timestamp(value){
  if(!value || /^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
  const v=String(value),explicit=/Z$|[+-]\d{2}:?\d{2}$/.test(v);
  return Date.parse(explicit?v:v+'+07:00');
}
function local(value=new Date().toISOString()){
  const n=timestamp(value);if(!Number.isFinite(n))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(n).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function valid(r){return Number.isFinite(timestamp(r.start))&&Number.isFinite(timestamp(r.end))&&timestamp(r.start)<=timestamp(r.end);}
function matches(at,r){const n=timestamp(at);return valid(r)&&Number.isFinite(n)&&n>=timestamp(r.start)&&n<timestamp(r.end)+60000;}
function events(ops,finance){
 const out=[],add=(id,at,kind,label,source,amount=null,division='Laundry')=>out.push({id,at,kind,label:Copy.summary(label,ops),source,amount,division:Copy.label(division),precise:Number.isFinite(timestamp(at))});
 for(const o of ops.orders||[]){add('new:'+o.id,o.created,'order',(o.excludeFromTotals?'Barang ditautkan ke pesanan · ':'Order masuk · ')+o.customer,o.id,o.total);out.at(-1).excludeFromTotals=!!o.excludeFromTotals;
   for(let i=0;i<(o.history||[]).length;i++){const h=o.history[i];add(o.id+':h:'+i,h.at,'activity',Copy.summary(h.text,ops),o.id);out.at(-1).actor=Copy.person(h.by||h.actor,ops.employees||[],'');}
   if(o.completed)add('end:'+o.id,o.completed,'completed','Laundry selesai · '+o.customer,o.id,o.total);
 }
 for(const t of finance?.transactions||[]){if(t.status==='Tercatat')add('trx:'+t.id,t.postedAt||t.createdAt,'finance',t.portalManaged?({receipt:'Pembayaran dibukukan',service:'Pendapatan laundry dibukukan',transfer:'Setoran dibukukan',expense:'Biaya dibukukan',refund:'Pengembalian dana dibukukan'}[t.kind]||'Transaksi dibukukan'):t.description,t.orderId||'',t.amount,finance.policies?.units?.find(u=>u.id===t.unit)?.name||t.unit);}
 for(const r of ops.reports||[])add('report:'+r.id,r.submittedAt,'report',r.activity,r.id,null,r.division);
 for(const s of ops.settlements||[])add('closing:'+s.id,s.createdAt,'closing','Pemeriksaan akhir kas · '+Copy.label(s.status),s.id,s.deposit);
 for(const a of ops.audit||[]){add('audit:'+a.id,a.at,'audit',Copy.summary(a.text,ops),'',null,'Global');out.at(-1).actor=Copy.person(a.actor,ops.employees||[],'');}
 return out.sort((a,b)=>(timestamp(b.at)||0)-(timestamp(a.at)||0));
}
const api={timestamp,local,valid,matches,events,zone};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.THJournalCore=api;
})(typeof window!=='undefined'?window:globalThis);
