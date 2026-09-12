// Supabase verifies passwords; Top Hills stores only encrypted provider tokens and opaque sessions.
const J=JSON.stringify,now=()=>Date.now(),q=(env,s,...p)=>env.DB.prepare(s).bind(...p);
class AuthError extends Error{constructor(message,status=400,code='auth_request_invalid',retryAfter){super(message);this.status=status;this.code=code;this.retryAfter=retryAfter}}
const need=(v,m,s=400)=>{if(!v)throw new AuthError(m,s)};
const clean=(s,n=150)=>String(s||'').trim().slice(0,n);
const bytes=s=>Uint8Array.from(s.match(/../g)||[],x=>parseInt(x,16));
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const hash=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
function publicKey(k){if(/^sb_publishable_[a-zA-Z0-9_-]+$/.test(k||''))return true;try{return JSON.parse(atob(k.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role==='anon'}catch{return false}}
export const authReady=env=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_URL||'')&&publicKey(env.SUPABASE_PUBLISHABLE_KEY)&&/^[a-f0-9]{64}$/.test(env.AUTH_SESSION_KEY||'');
const cookie=(token,age)=>`__Host-th-session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const getCookie=req=>req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-th-session='))?.slice(18)||'';
const reply=(data,status=200,sessionCookie)=>new Response(J(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Pragma':'no-cache','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff',...(sessionCookie?{'Set-Cookie':sessionCookie}:{})}});
export function authErrorResponse(error){
 if(!(error instanceof AuthError))return null;
 const response=reply({error:error.message,code:error.code,...(error.retryAfter?{retryAfter:error.retryAfter}:{})},error.status);
 response.headers.set('X-Top-Hills-Auth-Code',error.code);
 if(error.retryAfter)response.headers.set('Retry-After',String(error.retryAfter));
 return response;
}
const providerErrors={
 over_email_send_rate_limit:[429,'Pengiriman email verifikasi sedang dibatasi oleh layanan akun. Mengganti perangkat tidak menghapus batas ini. Jika sudah punya akun, pilih Masuk; untuk akun baru, Owner perlu memeriksa layanan pengiriman email.'],
 over_request_rate_limit:[429,'Layanan akun sedang membatasi permintaan. Tunggu sebelum mencoba kembali; perangkat baru dapat terkena batas yang sama.'],
 email_address_not_authorized:[503,'Layanan email belum diatur untuk mengirim konfirmasi ke alamat ini. Hubungi Owner untuk menyiapkan pengiriman email, atau masuk dengan akun ChatGPT yang sudah memiliki akses.'],
 email_provider_disabled:[503,'Pendaftaran email belum diaktifkan. Hubungi Owner atau gunakan akun ChatGPT yang sudah memiliki akses.'],
 signup_disabled:[503,'Pendaftaran akun baru sedang ditutup oleh layanan akun. Hubungi Owner.'],
 weak_password:[400,'Kata sandi belum memenuhi ketentuan keamanan. Gunakan minimal 12 karakter dengan kombinasi huruf besar, huruf kecil, angka, dan simbol.'],
 email_address_invalid:[400,'Alamat email tidak dapat digunakan. Periksa penulisan alamat email Anda.'],
 user_already_exists:[409,'Akun sudah terdaftar. Pilih Masuk atau Lupa kata sandi; perangkat baru tidak memerlukan pendaftaran ulang.'],
 email_exists:[409,'Akun sudah terdaftar. Pilih Masuk atau Lupa kata sandi; perangkat baru tidak memerlukan pendaftaran ulang.'],
 email_not_confirmed:[401,'Email belum dikonfirmasi. Pilih Konfirmasi email, periksa kotak masuk atau Spam. Gunakan Kirim ulang email bila diperlukan.'],
 otp_expired:[401,'Kode konfirmasi tidak berlaku atau sudah kedaluwarsa. Gunakan kode terbaru.'],
 invalid_credentials:[401,'Email atau kata sandi belum cocok. Periksa kembali atau gunakan Lupa kata sandi.'],
 captcha_failed:[400,'Verifikasi keamanan belum berhasil. Hubungi Owner jika pemeriksaan keamanan tidak muncul.']
};
function providerFailure(response,value){
 const supplied=typeof value.code==='string'?value.code:value.error_code;
 const code=Object.hasOwn(providerErrors,supplied)?supplied:'auth_provider_error';
 const [status,message]=providerErrors[code]||[response.status===429?429:response.status>=500?503:401,response.status===429?'Layanan akun sedang membatasi permintaan. Tunggu sebelum mencoba kembali.':'Permintaan akun belum berhasil. Periksa data yang diisi atau coba lagi setelah layanan pulih.'];
 const raw=response.headers.get('Retry-After'),seconds=raw&&/^\d{1,5}$/.test(raw)?Number(raw):0;
 return new AuthError(message,status,code,seconds>0&&seconds<=86400?seconds:undefined);
}
async function seal(env,v){const key=await crypto.subtle.importKey('raw',bytes(env.AUTH_SESSION_KEY),'AES-GCM',false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));return hex(iv)+'.'+hex(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(J(v))));}
async function unseal(env,s){const [iv,b]=s.split('.'),key=await crypto.subtle.importKey('raw',bytes(env.AUTH_SESSION_KEY),'AES-GCM',false,['decrypt']);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},key,bytes(b))));}
async function provider(env,path,data,access,method='POST'){need(authReady(env),'Login email belum terhubung. Owner perlu mengatur Supabase Auth.',503);let r;try{r=await fetch(env.SUPABASE_URL+'/auth/v1/'+path,{method,headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},body:data?J(data):undefined,signal:AbortSignal.timeout(12000)});}catch{throw new AuthError('Layanan login belum merespons. Coba lagi sebentar.',503,'auth_provider_unavailable')}const v=await r.json().catch(()=>({}));if(!r.ok)throw providerFailure(r,v);return v;}
const identity=v=>{need(v?.id&&v.email&&v.email_confirmed_at,'Konfirmasikan email sebelum masuk.',401);return {id:'sb:'+v.id,email:v.email,name:clean(v.user_metadata?.full_name)||v.email,provider:'supabase'};};
async function start(env,req,result){need(result.access_token&&result.refresh_token&&result.user,'Sesi login tidak lengkap.',503);const user=identity(result.user),token=random(),at=now();await q(env,'INSERT OR IGNORE INTO members(id,name,email,role,status,profile,created_at) VALUES(?,?,?,?,?,?,?)',user.id,user.name,user.email,'Operator','Menunggu',J({requestedRole:result.user.user_metadata?.requested_role==='Owner'?'Owner':'Operator'}),new Date(at).toISOString()).run();await q(env,'INSERT INTO staff_sessions(id,user_id,cipher,expires_at,token_expires_at,created_at,last_seen,device) VALUES(?,?,?,?,?,?,?,?)',await hash(token),user.id,await seal(env,{access:result.access_token,refresh:result.refresh_token,user}),at+7*86400000,at+(result.expires_in||3600)*1000,at,at,clean(req.headers.get('User-Agent'),250)).run();await q(env,'DELETE FROM staff_sessions WHERE expires_at<?',at-86400000).run();return {user,token};}
async function session(req,env){const token=getCookie(req);if(!token)return null;need(authReady(env),'Login email belum terhubung.',503);need(/^[a-f0-9]{64}$/.test(token),'Sesi berakhir. Masuk kembali.',401);const id=await hash(token),s=await q(env,'SELECT * FROM staff_sessions WHERE id=?',id).first();need(s&&!s.revoked&&s.expires_at>now()&&s.last_seen>now()-12*3600000,'Sesi berakhir. Masuk kembali.',401);let payload=await unseal(env,s.cipher);if(s.token_expires_at<now()+60000){const at=now(),lock=await q(env,'UPDATE staff_sessions SET lease_until=? WHERE id=? AND lease_until<? AND revoked=0',at+20000,id,at).run();need(lock.meta.changes===1,'Sesi sedang diperbarui. Coba lagi sebentar.',503);try{const refreshed=await provider(env,'token?grant_type=refresh_token',{refresh_token:payload.refresh});const user=identity(refreshed.user);need(user.id===s.user_id,'Identitas sesi berubah.',401);payload={access:refreshed.access_token,refresh:refreshed.refresh_token,user};await q(env,'UPDATE staff_sessions SET cipher=?,token_expires_at=?,lease_until=0 WHERE id=? AND revoked=0',await seal(env,payload),now()+(refreshed.expires_in||3600)*1000,id).run();}catch(e){await q(env,'UPDATE staff_sessions SET lease_until=0,revoked=CASE WHEN ?=401 THEN 1 ELSE revoked END WHERE id=?',e.status||503,id).run();throw e;}}if(now()-s.last_seen>60000)await q(env,'UPDATE staff_sessions SET last_seen=? WHERE id=? AND revoked=0',now(),id).run();return {id,user:payload.user,access:payload.access};}
export async function resolveStaffIdentity(req,env){if(getCookie(req)){const s=await session(req,env);return s.user;}const id=req.headers.get('oai-authenticated-user-id');if(!id)return null;let name=req.headers.get('oai-authenticated-user-full-name')||'';if(req.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8')try{name=decodeURIComponent(name)}catch{name=''}return {id,name:name||req.headers.get('oai-authenticated-user-email')||'Petugas Top Hills',email:req.headers.get('oai-authenticated-user-email')||'',provider:'chatgpt'};}
async function limit(req,env,email,group){const slot=Math.floor(now()/600000),ip=req.headers.get('CF-Connecting-IP')||'unknown';for(const [kind,value,max] of [['ip',ip,40],['email',email.toLowerCase(),8]]){const id=await hash(kind+':'+(kind==='email'?group+':':'')+value+':'+slot),v=await q(env,'INSERT INTO auth_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',id,now()+1200000).first();if(v.count>max)throw new AuthError('Percobaan untuk akun atau jaringan ini mencapai batas sementara. Tunggu sebelum mencoba kembali.',429,'auth_attempts_limited',Math.max(1,Math.ceil(((slot+1)*600000-now())/1000)));}await q(env,'DELETE FROM auth_limits WHERE expires_at<?',now()).run();}
export async function staffAuthRoute(req,env){const u=new URL(req.url),path=u.pathname;if(req.method==='GET'&&path==='/api/auth/config')return reply({enabled:authReady(env),provider:'Supabase Auth',idleHours:12,maxDays:7});
 if(req.method==='GET'&&path==='/api/auth/sessions'){const s=await session(req,env);need(s,'Masuk dengan email Top Hills untuk mengelola sesi perangkat.',401);const rows=(await q(env,'SELECT id,device,created_at,last_seen,expires_at FROM staff_sessions WHERE user_id=? AND revoked=0 AND expires_at>?',s.user.id,now()).all()).results;return reply({sessions:rows.map(r=>({...r,current:r.id===s.id}))});}
 need(req.method==='POST','Metode tidak tersedia.',405);need(req.headers.get('Origin')===u.origin&&req.headers.get('X-Top-Hills')==='1','Permintaan lintas situs ditolak.',403);need(Number(req.headers.get('Content-Length'))<20000,'Formulir terlalu besar.',413);const p=await req.json();need(J(p).length<20000,'Formulir terlalu besar.',413);
 if(path==='/api/auth/logout'){const token=getCookie(req);if(token)await q(env,'UPDATE staff_sessions SET revoked=1,cipher=? WHERE id=?','',await hash(token)).run();return reply({redirect:req.headers.get('oai-authenticated-user-id')?'/signout-with-chatgpt?return_to=%2Flogin':'/login'},200,cookie('',0));}
 if(path==='/api/auth/revoke'){const s=await session(req,env);need(s,'Masuk terlebih dahulu.',401);if(p.all)await q(env,'UPDATE staff_sessions SET revoked=1,cipher=? WHERE user_id=?','',s.user.id).run();else await q(env,'UPDATE staff_sessions SET revoked=1,cipher=? WHERE id=? AND user_id=?','',clean(p.id),s.user.id).run();return reply({revoked:true},200,p.all||p.id===s.id?cookie('',0):undefined);}
 need(authReady(env),'Login email belum terhubung. Owner perlu mengatur Supabase Auth.',503);
 if(path==='/api/auth/set-password'){
  need(typeof p.accessToken==='string'&&p.accessToken.length<=8192&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(p.accessToken),'Tautan undangan tidak valid. Buka tautan terbaru dari email.',401);
  need(typeof p.password==='string'&&p.password.length>=12&&p.password.length<=128,'Kata sandi baru minimal 12, maksimal 128 karakter.');
  need(p.password===p.passwordConfirm,'Ulangi kata sandi yang sama.');
  await limit(req,env,await hash(p.accessToken),'password-setup');
  // Only the provider may establish which account owns the email-link session.
  // The submitted email, user ID and requested role are never used for authorization.
  const user=identity(await provider(env,'user',undefined,p.accessToken,'GET'));
  const updated=identity(await provider(env,'user',{password:p.password},p.accessToken,'PUT'));
  need(updated.id===user.id,'Identitas akun tidak cocok. Buka tautan terbaru dari email.',401);
  await q(env,'UPDATE staff_sessions SET revoked=1,cipher=? WHERE user_id=?','',user.id).run();
  return reply({passwordUpdated:true,next:'login',message:'Kata sandi sudah disimpan. Masuk menggunakan email dan kata sandi baru.'},200,cookie('',0));
 }
 const email=clean(p.email,254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Alamat email tidak valid.');
 if(['signup','login','reset'].some(a=>path==='/api/auth/'+a))need(typeof p.password==='string'&&p.password.length>=(path.endsWith('/login')?1:12)&&p.password.length<=128,'Kata sandi baru minimal 12, maksimal 128 karakter.');
 if(path==='/api/auth/signup')need(clean(p.name).length>=2,'Nama minimal 2 karakter.');
 need(['signup','login','confirm','resend','recover','reset'].some(a=>path==='/api/auth/'+a),'Halaman tidak tersedia.',404);
 const group=['signup','resend'].some(a=>path.endsWith('/'+a))?'signup':['confirm','reset'].some(a=>path.endsWith('/'+a))?'verify':path.endsWith('/recover')?'recover':'login';await limit(req,env,email,group);
 if(path==='/api/auth/resend'){await provider(env,'resend?redirect_to='+encodeURIComponent(u.origin+'/login'),{type:'signup',email});return reply({next:'confirm',retryAfter:60,message:'Jika akun menunggu konfirmasi, email baru akan dikirim. Periksa kotak masuk dan Spam, lalu buka tautannya. Tidak perlu mendaftar ulang.'});}
 if(path==='/api/auth/signup'){const v=await provider(env,'signup?redirect_to='+encodeURIComponent(u.origin+'/login'),{email,password:p.password,data:{full_name:clean(p.name),requested_role:p.role==='Owner'?'Owner':'Operator'}});if(v.access_token&&v.refresh_token&&v.user?.email_confirmed_at){const s=await start(env,req,v);return reply({user:s.user,redirect:'/'},200,cookie(s.token,7*86400));}return reply({next:'confirm',message:'Periksa email konfirmasi. Buka tautannya, lalu kembali ke Masuk; bila email berisi kode, masukkan di bawah. Akun baru tetap memerlukan persetujuan Owner. Jika sudah pernah mendaftar, gunakan Masuk.'});}
 if(path==='/api/auth/login'){const v=await provider(env,'token?grant_type=password',{email,password:p.password});const s=await start(env,req,v);return reply({user:s.user,redirect:'/'},200,cookie(s.token,7*86400));}
 if(path==='/api/auth/confirm'){const v=await provider(env,'verify',{email,token:clean(p.code,20),type:'signup'});const s=await start(env,req,v);return reply({user:s.user,redirect:'/'},200,cookie(s.token,7*86400));}
 if(path==='/api/auth/recover'){try{await provider(env,'recover',{email});}catch(e){if(e.status>=500||e.status===429)throw e;}return reply({message:'Jika alamat email terdaftar, instruksi pemulihan akan dikirim.'});}
 if(path==='/api/auth/reset'){const v=await provider(env,'verify',{email,token:clean(p.code,20),type:'recovery'});const user=identity(v.user);await provider(env,'user',{password:p.password},v.access_token,'PUT');await q(env,'UPDATE staff_sessions SET revoked=1,cipher=? WHERE user_id=?','',user.id).run();return reply({message:'Kata sandi diperbarui. Masuk kembali di setiap perangkat.'},200,cookie('',0));}
 throw new AuthError('Halaman tidak tersedia.',404);
}
