(function(){'use strict';
const menuItems=[['home','home','Jurnal usaha'],['operations','laundry','Operasional'],['finance','wallet','Laporan'],['guide','book','Buku panduan'],['team','users','Tim & evaluasi']];
actions['workspace-menu']=function(){
  const role=window.THAccess?.current()?.role||ui.role;
  const items=menuItems.filter(x=>role!=='Finance'||['home','finance','guide'].includes(x[0]));
  const navigation=items.map(([id,ic,title])=>btn(icon(ic)+(id==='team'&&role!=='Owner'?'Laporan saya':title),'nav',id,'nav-item'+(ui.page===id?' active':''))).join('');
  const ownerLinks=role==='Owner'?btn('Kesiapan usaha','readiness','','nav-item','shield')+`<button type="button" class="nav-item" data-access="manage">${icon('users')}Akses akun</button>`+btn('Pengaturan','settings','','nav-item','settings'):'';
  const backup=['Owner','Finance'].includes(role)?btn('Cadangkan data','backup','','nav-item','download'):'';
  openModal('Ruang kerja Top Hills',`<nav class="workspace-menu-grid" aria-label="Navigasi ruang kerja">${navigation}<a class="nav-item" href="/laundry-desk">Meja laundry & QR</a><div class="workspace-menu-divider"></div>${ownerLinks}${backup}<button type="button" class="nav-item" data-cloud-profile>${icon('shield')}Akun saya</button></nav>`);
};
for(const name of ['nav','goto']){
 const original=actions[name];
 actions[name]=async function(...args){closeModal();const result=await original(...args);document.querySelector('#main')?.focus({preventScroll:true});return result;};
}
// Tablists use roving focus; arrow keys move focus and Enter/Space activates.
function tabFocus(){
 for(const list of document.querySelectorAll('[role="tablist"]')){
  const tabs=[...list.querySelectorAll('[role="tab"]')],current=tabs.find(t=>t.getAttribute('aria-selected')==='true')||tabs[0];
  for(const t of tabs)t.tabIndex=t===current?0:-1;
 }
}
document.addEventListener('keydown',e=>{
 const tab=e.target.closest?.('[role="tab"]');if(!tab)return;
 const list=tab.closest('[role="tablist"]'),tabs=[...list.querySelectorAll('[role="tab"]')];
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();const i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 for(const t of tabs)t.tabIndex=-1;tabs[next].tabIndex=0;tabs[next].focus();
});
document.addEventListener('toggle',e=>{if(e.target.matches?.('[data-fin-extra]')&&window.THFinance)THFinance.state.filtersOpen=e.target.open;},true);
const previousRender=render;
render=function(){
 previousRender();tabFocus();
 for(const body of document.querySelectorAll('#main .table-wrap tbody:empty, #main .finance-table-wrap tbody:empty')){
  const columns=body.closest('table').querySelectorAll('thead tr:first-child th').length||1;
  body.innerHTML=`<tr><td colspan="${columns}">${empty('Belum ada catatan','Data yang Anda tambahkan akan tampil di sini. Periksa juga rentang waktu yang dipilih.')}</td></tr>`;
 }
 const main=document.querySelector('#main');if(main)main.dataset.page=ui.page;
 const menu=document.querySelector('.workspace-menu-button');if(menu){menu.setAttribute('aria-label','Buka menu ruang kerja');menu.setAttribute('aria-haspopup','dialog');}
 for(const nav of document.querySelectorAll('.sidebar nav [data-action="nav"], .bottom-nav [data-action="nav"]')){if(nav.dataset.id===ui.page)nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');}
};
if(window.THCloud){const paint=THCloud.paintStatus;THCloud.paintStatus=function(){paint();const status=document.querySelector('[data-ui-fin-sync]');if(status)status.textContent=({synced:'Tersinkron',saving:'Menyimpan…',offline:'Koneksi terputus',error:'Periksa penyimpanan',loading:'Menghubungkan…',locked:'Akses dibatasi'})[THCloud.status]||'Periksa koneksi';};}
})();
