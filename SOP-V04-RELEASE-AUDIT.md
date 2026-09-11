# Top Hills · SOP v0.4 release audit

11 September 2026. Latest supplied SOP: SOP_Operasional_Laundry_Top_Hills_v0.4_Draft (3)(1).docx.

## Acceptance coverage

|No|Requirement|Coverage|Evidence / limitation|
|---|---|---|---|
|01|QR kamar membuat THL|Tersedia|Token kamar dikunci, THL dibuat server, hasil tersimpan. Ponsel nyata belum diuji.|
|02|Submit dua kali|Tersedia|Kunci pengiriman mengembalikan order yang sama.|
|03|QR atau kamar dimodifikasi|Tersedia|Token dan perubahan kamar ditolak server.|
|04|Dua petugas menerima bersamaan|Tersedia|Satu penerima pertama; perubahan lama ditolak.|
|05|Revisi R1 → R2|Tersedia|Perbandingan tampil; penerimaan ulang wajib. Revisi metode memperbarui tahap.|
|06|Batal sebelum diterima|Tersedia|Tanpa PAY / SET; riwayat tetap disimpan.|
|07|Batal setelah dijemput|Tersedia|Barang wajib dikembalikan dengan bukti.|
|08|Assisted, kamar diketahui|Sebagian|THL, pelaku dan konfirmasi tersedia. Foto dan penerimaan fisik merupakan langkah berikutnya, belum satu pengiriman atomik.|
|09|Identitas pending|Tersedia|Boleh timbang; PAY dan proses ditolak sampai identitas confirmed.|
|10|Barang tak dikenal → INT|Sebagian|INT, karantina, label dan linking tersedia; foto/kantong harus segera dilengkapi petugas.|
|11|Customer konfirmasi identitas|Tersedia|Konfirmasi mengembalikan tahap yang benar, termasuk setelah karantina.|
|12|Bukan milik saya|Tersedia|Identitas ditahan, barang dikarantina dan incident terbuka.|
|13|Proses tanpa syarat|Tersedia|Ditolak dan percobaan tindakan dicatat.|
|14|Intake melebihi 5 menit|Sebagian|Alert dari waktu kedatangan yang dicatat. Belum ada deteksi sensor atau push otomatis.|
|15|Siklus mesin tanpa THL|Sebagian|Batch kosong ditolak dan diaudit. Belum ada daftar siklus terpisah / sensor serta incident mesin otomatis di antrean.|
|16|Hapus / ubah sumber|Tersedia|Tidak ada hard delete; sumber tidak dapat diubah melalui tindakan pelanggan. Void Owner meninggalkan jejak.|
|17|Label hilang / rusak|Tersedia|Proses, QC dan handover diblokir tanpa label; relabel memakai bukti.|
|18|Perubahan harga|Sebagian|Timbang ulang sebelum paid membatalkan attempt lama. Diskon/tambahan dan koreksi setelah paid belum lengkap.|
|19|PAY kedaluwarsa|Sebagian|Attempt bisa expired tanpa menghapus THL. Kedaluwarsa gateway otomatis belum aktif.|
|20|Webhook QRIS ganda|Belum aktif|Provider QRIS, validasi signature, webhook dan payout nyata belum dipasang.|
|21|Screenshot pembayaran|Tersedia|Hanya menunggu verifikasi; tidak otomatis lunas. Transfer diperiksa Owner/Finance.|
|22|Cash dan SET in transit|Tersedia|Penerima cash, kuitansi dan SET dicatat. Sisa pembayaran memakai metode awal; campuran metode belum didukung.|
|23|Pemeriksa SET independen|Tersedia|Penerima uang atau pengaju setoran tidak dapat menyetujui SET sendiri.|
|24|SET kurang / lebih|Tersedia|Exception tetap terbuka. Koreksi dapat diajukan ulang; riwayat nominal disimpan.|
|25|Pembatalan setelah paid|Sebagian|PAY tetap, REF dibuat, bukti pengembalian dan rekonsiliasi independen wajib. Refund gagal/ditolak serta jurnal adjustment belum otomatis lengkap.|
|26|WhatsApp gagal / retry|Belum aktif|Order tetap tersimpan. Antrean ulang tersedia, tetapi provider belum mengirim atau mengonfirmasi delivery.|
|27|Tanpa bukti handover|Tersedia|Tidak dapat completed. Custody, label, identitas dan pembayaran/persetujuan bayar nanti diperiksa.|
|28|Mendekati checkout|Sebagian|Alert <24 jam dan prioritas visual dalam halaman tersedia. Penjadwalan serta notifikasi eskalasi otomatis belum aktif.|

## Changes
- New /demo customer QR, simulated Operator and Owner workspace; D1 laundry_demo_sessions only, 7-day lifetime, maximum 10 orders, CAS revision and idempotency. No production finance/proof/order writes. Shared link grants access to all simulated roles; it is not staff authentication.
- Fixed cancelled payment attempts, held-stage restoration, QC/handover label guards, physical INT → THL continuation, ownership recovery, method revisions, SET OVER resubmission, refund reconciliation, shift-proof ownership and protected customer operational photos.
- Partial payment method changes blocked until proper per-method settlement exists; cash summary reads received attempts instead of last payment method.
- Search/status/date filters operate before pagination. Checkout risk sorted within the returned page. UI shows Indonesian states, intake completeness, R1/latest comparison and actor names.

## Hosting and storage
Current Site audience is public; operational APIs still require active staff membership. Original Owner and accounts preserved. No reset or production seed. Database migrations are additive. Supabase email/password adapter is implemented but disabled without project configuration. Do not claim email or real provider tests passed. Existing finance workspace root JSON size limit remains a capacity concern.

## Verification
Node engine/API tests exercise local SQLite and mock object storage/provider; 20 interactive engine scenarios execute with a DOM stub. Browser/mobile visual, camera, real email/Supabase, QRIS and WhatsApp integration QA remain unperformed. /sop-coverage exposes this same boundary to users.
