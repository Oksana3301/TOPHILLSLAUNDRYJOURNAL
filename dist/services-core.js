(function(root){
'use strict';
const VERSION='top-hills-services-2026-09-v1';
const units=['KG','Lembar','Helai','PCS','Stel','Load'];
const rows=[
 ['bed-cover-l','Bed Cover L/Jumbo',72,35000,'Lembar',0,'Rumah tangga'],
 ['bed-cover-m','Bed Cover M',72,30000,'Lembar',0,'Rumah tangga'],
 ['bed-cover-s','Bed Cover S',72,25000,'Lembar',0,'Rumah tangga'],
 ['cukedo','Cukedo (Cuci Kering Doang)',3,15000,'Load',0,'Kiloan & cepat',2],
 ['cukeli','Cukeli (Cuci Kering Lipat)',4,20000,'Load',0,'Kiloan & cepat',2],
 ['express-shine','Express Shine',6,15000,'KG',2,'Kiloan & cepat'],
 ['gorden','Gorden',72,15000,'KG',0,'Rumah tangga'],
 ['handuk-l','Handuk L',48,15000,'Helai',0,'Rumah tangga'],
 ['handuk-m','Handuk M',48,10000,'Helai',0,'Rumah tangga'],
 ['handuk-s','Handuk S',48,5000,'Helai',0,'Rumah tangga'],
 ['iron-only','Iron Only',48,5000,'KG',0,'Setrika'],
 ['kain-panjang','Kain Panjang',48,4000,'PCS',0,'Pakaian & ibadah'],
 ['keset','Keset',48,8000,'Lembar',2,'Rumah tangga'],
 ['mukena','Mukena',48,8000,'Stel',0,'Pakaian & ibadah'],
 ['quick-clean','Quick Clean',24,12000,'KG',2,'Kiloan & cepat'],
 ['quick-iron','Quick Iron',24,6000,'KG',0,'Setrika'],
 ['regular-refresh','Regular Refresh',48,6000,'KG',2,'Kiloan & cepat'],
 ['rok-tile','Rok Tile',48,12000,'PCS',0,'Pakaian & ibadah'],
 ['sajadah-jumbo','Sajadah Jumbo',48,15000,'PCS',0,'Pakaian & ibadah'],
 ['sajadah-kecil','Sajadah Kecil',48,5000,'PCS',0,'Pakaian & ibadah'],
 ['sajadah-standar','Sajadah Standar',48,8000,'PCS',0,'Pakaian & ibadah'],
 ['sarung','Sarung',48,5000,'PCS',0,'Pakaian & ibadah'],
 ['selimut-l','Selimut L',48,25000,'Helai',0,'Rumah tangga'],
 ['selimut-m','Selimut M',48,20000,'Helai',0,'Rumah tangga'],
 ['selimut-s','Selimut S',48,15000,'Helai',0,'Rumah tangga'],
 ['sprei-double','Sprei Double',48,20000,'Lembar',0,'Rumah tangga'],
 ['sprei-single','Sprei Single',48,10000,'Helai',0,'Rumah tangga'],
 ['sweater','Sweater/Jaket/Denim',48,10000,'PCS',0,'Pakaian & ibadah'],
 ['vitrase','Vitrase',72,18000,'KG',0,'Rumah tangga'],
 ['vitrase-rimpel','Vitrase Rimpel',72,20000,'KG',2,'Rumah tangga']
];
const catalog=()=>rows.map(([id,name,hours,price,unit,minQuantity,category,loadKg])=>({id:'THL-'+id,name,hours,price,unit,minQuantity,category,loadKg:loadKg||0}));
function normalize(p){return {id:p.id||'',name:p.name,price:p.price,hours:p.hours,unit:p.unit||'KG',minQuantity:p.minQuantity??0,loadKg:p.unit==='Load'?(p.loadKg||2):0,category:p.category||'Lainnya'};}
function valid(p){return !!p&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=100&&Number.isSafeInteger(p.price)&&p.price>0&&p.price<=1000000&&Number.isFinite(p.hours)&&p.hours>0&&p.hours<=240&&units.includes(p.unit||'KG')&&Number.isFinite(p.minQuantity??0)&&(p.minQuantity??0)>=0&&(p.minQuantity??0)<=100&&(['KG','Load'].includes(p.unit||'KG')||Number.isInteger(p.minQuantity??0))&&(p.unit!=='Load'||Number.isFinite(p.loadKg)&&p.loadKg>0&&p.loadKg<=100);}
function weighted(p){return ['KG','Load'].includes(p.unit||'KG');}
function quote(service,weight=0,quantity=0){const p=normalize(service);if(!valid(p))throw Error('Layanan tidak valid.');const n=Number(weighted(p)?weight:quantity);if(!Number.isFinite(n)||n<0||n>1000||(!weighted(p)&&!Number.isInteger(n)))throw Error(weighted(p)?'Berat tidak valid.':'Jumlah barang harus bilangan bulat.');const billed=p.unit==='Load'?Math.ceil(Math.round(n*1000)/1000/p.loadKg):n;return {quantity:billed,billedQuantity:billed,total:Math.round(billed*p.price),minimumMet:n===0||billed>=p.minQuantity,unit:p.unit};}
function snapshot(o){return normalize(o.serviceSnapshot||{name:o.package,price:o.rate,hours:48,unit:'KG'});}
function quantityText(o){const p=snapshot(o),n=o.billedQuantity??o.weight??0;return p.unit==='Load'?`${n} load (${o.weight||0} kg)`:`${n} ${p.unit}`;}
function location(t){return [t.building?'Gedung '+t.building:'',t.floor?'Lantai '+t.floor:'',t.room?'Kamar '+t.room:''].filter(Boolean).join(' · ');}
function duration(p){return p.hours%24===0?p.hours/24+' hari':p.hours+' jam';}
function rule(p){return p.unit==='Load'?`1 load maksimal ${p.loadKg} kg; kelebihan dihitung load berikutnya.`:p.minQuantity?`Minimal ${p.minQuantity} ${p.unit} per order.`:'Tanpa minimal order.';}
function install(operations){if(operations.settings.serviceCatalogVersion===VERSION)return false;const official=catalog(),names=new Set(official.map(p=>p.name.toLowerCase()));const legacy=new Set(['cuci + setrika','cuci lipat','express']);operations.settings.packages=[...official,...(operations.settings.packages||[]).filter(p=>!names.has(p.name.toLowerCase())&&!legacy.has(p.name.toLowerCase())).map(p=>({...normalize(p),id:p.id||'custom-'+p.name.toLowerCase().replace(/[^a-z0-9]/g,'-')}))];operations.settings.serviceCatalogVersion=VERSION;return true;}
function validateOrder(o,prior,packages,role){
 if(!o.serviceSnapshot){if(prior?.serviceSnapshot)throw Error('Rincian layanan order tidak dapat dihapus.');if(!prior)throw Error('Pilih layanan dari daftar terbaru.');return;}
 const p=o.serviceSnapshot;if(!valid(p)||!p.id)throw Error('Rincian layanan tidak valid.');
 if(prior){if(JSON.stringify(prior.serviceSnapshot)!==JSON.stringify(p))throw Error('Tarif layanan order lama tidak dapat ditimpa.');}
 else {const selected=packages.find(x=>x.id===p.id);if(!selected||JSON.stringify(normalize(selected))!==JSON.stringify(normalize(p)))throw Error('Layanan berubah. Muat ulang daftar layanan.');}
 if(o.rate!==p.price||o.package!==p.name)throw Error('Tarif harus sesuai layanan yang dicatat.');
 if(!Number.isFinite(o.weight)||o.weight<0||o.weight>1000)throw Error('Berat order tidak valid.');
 const q=quote(p,o.weight,o.quantity);if(q.quantity!==o.quantity||q.billedQuantity!==o.billedQuantity)throw Error('Jumlah tagihan tidak cocok dengan layanan.');
 if(!q.minimumMet)throw Error(rule(p));
 if(!prior&&o.priceAdjustment)throw Error('Order baru menggunakan tarif layanan.');if(role!=='Owner'&&JSON.stringify(o.priceAdjustment)!==JSON.stringify(prior?.priceAdjustment))throw Error('Koreksi harga memerlukan Owner.');if(o.priceAdjustment||o.total!==q.total){if(!(prior&&o.priceAdjustment&&Number.isSafeInteger(o.priceAdjustment.amount)&&o.total===q.total+o.priceAdjustment.amount&&o.priceAdjustment.reason?.trim().length>=5&&(role==='Owner'||JSON.stringify(o.priceAdjustment)===JSON.stringify(prior.priceAdjustment))))throw Error('Total tidak cocok dengan tarif layanan.');}
 if(!['Pesanan Masuk','Menunggu Dijemput','Sudah Dijemput','Tertahan','Dibatalkan'].includes(o.stage)&&q.quantity<=0)throw Error('Lengkapi berat atau jumlah barang sebelum penerimaan.');
}
const api={VERSION,units,catalog,normalize,valid,weighted,quote,snapshot,quantityText,location,duration,rule,install,validateOrder};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.THServices=api;
})(typeof window!=='undefined'?window:globalThis);
