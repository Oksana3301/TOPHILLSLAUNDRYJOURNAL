import { emptyWorkspace } from './empty-workspace.mjs';

// One-shot maintenance command for the Owner's explicit reset request on 2026-09-10.
// Disabled unless a short-lived server secret is set. Never accepts identity headers
// as maintenance authorization, and never deletes or updates an account row.
export const RESET_ID = 'owner-request-2026-09-10-business-reset-v1';
const tables = ['journal_lines', 'journals', 'attachments', 'finance_transactions', 'finance_records', 'finance_audit', 'mutations'];
const fail=(message,status)=>{throw Object.assign(new Error(message),{status});};
const encode=s=>new TextEncoder().encode(s);
async function equalSecret(a,b){
 const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',encode(s))));
 const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
export async function resetBusiness(req,env){
 if(req.method!=='POST')fail('Méthode tidak tersedia.',405);
 const token=req.headers.get('X-Top-Hills-Maintenance')||'';
 if(!env.TOP_HILLS_RESET_TOKEN || !env.TOP_HILLS_RESET_EXPIRES || Date.now()>Date.parse(env.TOP_HILLS_RESET_EXPIRES) || !Number.isFinite(Date.parse(env.TOP_HILLS_RESET_EXPIRES)) || token.length<32 || !(await equalSecret(token,env.TOP_HILLS_RESET_TOKEN)))fail('Akses maintenance tidak tersedia.',403);
 const p=await req.json();if(p.command!==RESET_ID)fail('Perintah reset tidak valid.',400);
 const q=(sql,...v)=>env.DB.prepare(sql).bind(...v);
 let row=await q('SELECT revision,data FROM workspace WHERE id=?','main').first();
 if(!row)fail('Ruang kerja belum ada.',409);
 let w=JSON.parse(row.data);
 if(w.maintenance?.resetId!==RESET_ID){
   const at=new Date().toISOString(),marker=crypto.randomUUID(),clean=emptyWorkspace(w.ownerId,at);
   clean.maintenance={resetId:RESET_ID,resetAt:at,phase:'purging',accountsPreserved:true};
   const guard="EXISTS (SELECT 1 FROM workspace WHERE id='main' AND updated_at=?)";
   const batch=[q('UPDATE workspace SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',JSON.stringify(clean),marker,'main',row.revision),...tables.map(t=>q(`DELETE FROM ${t} WHERE ${guard}`,marker))];
   const result=await env.DB.batch(batch);if(result[0].meta.changes!==1)fail('Data berubah; jalankan kembali reset yang sama.',409);
   w=clean;row.revision++;
 }
 if(w.maintenance.phase!=='completed'){
   // Removing all proof objects also cleans abandoned uploads. The database stays
   // in maintenance mode until cleanup succeeds; repeating this command is safe.
   let cursor;do{const page=await env.BUCKET.list({prefix:'proof/',limit:500,...(cursor?{cursor}:{})});for(const o of page.objects)await env.BUCKET.delete(o.key);cursor=page.truncated?page.cursor:undefined;}while(cursor);
   w.maintenance.phase='completed';w.maintenance.completedAt=new Date().toISOString();
   const result=await q('UPDATE workspace SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',JSON.stringify(w),crypto.randomUUID(),'main',row.revision).run();
   if(result.meta.changes!==1)fail('Penyelesaian reset perlu dicoba ulang.',409);
 }
 const members=await q('SELECT count(*) AS total FROM members').first();
 return new Response(JSON.stringify({resetId:RESET_ID,status:'completed',accountsPreserved:members.total,businessRecords:0,proofObjects:0}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
