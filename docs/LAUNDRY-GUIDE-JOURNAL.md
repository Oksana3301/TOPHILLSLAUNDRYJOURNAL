# Checklist order dan sinkronisasi jurnal

Acuan: SOP v0.4 untuk Meja Laundry; SOP v0.3 untuk jurnal/laporan; identitas visual Master Prompt Nurio yang diunggah ulang. Arsip asli dan SHA-256 ada pada `source-documents.json`.

## Pemakaian

1. Buka Meja Laundry, pilih order, ikuti **Checklist penyelesaian**. Nomor, peran, bukti dan langkah berikutnya tampil bersama. Pilih semua peran atau tugas akun sendiri.
2. Hijau menunjukkan langkah berbukti selesai. Biru menunjukkan langkah berikutnya; merah/kuning menunjukkan kendala/perhatian. Persetujuan pelanggan, pembayaran, barang dan setoran tetap status terpisah.
3. Buka kondisi yang sesuai pada **28 skenario**. Petugas mencatat hasil pemeriksaan atas nama akunnya. Catatan tidak dapat menggantikan persetujuan, bukti atau pembayaran; perubahan order membuat pemeriksaan sebelumnya perlu ditinjau ulang.
4. Order langsung terlihat pada **Jurnal usaha → Seluruh order**. Detail membuka sumber di Meja Laundry. INT yang telah ditautkan tetap dapat dilacak tanpa menggandakan jumlah order/omzet.
5. Owner/Finance membuka **Periksa laporan order**. Kejadian uang/jasa membuat usulan unik saat laporan dimuat atau sumber dipindai. Periksa dan bukukan sesuai tanggal sumber; usulan belum masuk P&L/neraca/arus kas.
6. Lengkapi bukti dan pemeriksaan independen. Rekonsiliasi setoran beserta biaya dapat memakai satu mutasi bank bersih. Final memerlukan semua kejadian terkait dibukukan serta kewajiban dana terselesaikan.

## Dasar angka

| Kejadian | Pembukuan setelah diperiksa |
|---|---|
| Order/check-in tanpa penerimaan atau jasa selesai | Terlihat dalam daftar; belum pendapatan/kas |
| Pembayaran sebelum serah terima | Kas/bank dan uang muka pelanggan |
| Jasa selesai | Pendapatan; memakai uang muka atau membentuk piutang |
| Pelunasan piutang | Kas/bank bertambah, piutang berkurang |
| Setoran cash | Transfer kas penerimaan ke bank; bukan pendapatan kedua |
| Biaya setoran | Beban bank terpisah; nilai bank bersih tetap sesuai mutasi |
| Batal sebelum jasa, refund penuh | Uang muka dikembalikan dari rekening/kas yang dibuktikan |

Penerimaan bertahap menyimpan setiap attempt. Setoran berikutnya memakai total kumulatif, lalu membukukan selisih terhadap setoran cocok sebelumnya. Verifikasi sesudah akhir bulan boleh menjadi bukti penyelesaian; tanggal kejadian jurnal tidak dimundurkan.

## Batas dan kontrol

- Pembukuan tidak berjalan sebagai layanan otomatis di luar akses aplikasi. Sinkronisasi aktif saat halaman memuat/menyegarkan; tab berisi formulir belum tersimpan tidak ditimpa.
- QRIS provider dan WhatsApp otomatis belum aktif. Gunakan metode Cash/Transfer dan komunikasi manual sesuai SOP.
- Pembatalan otomatis saat ini mengembalikan seluruh dana, dengan dukungan pembayaran refund bertahap. Potongan biaya, penolakan refund, sengketa setelah barang selesai dan koreksi keuangan khusus membutuhkan keputusan Owner berbukti; tetap sebagai kendala terbuka sampai diselesaikan. Panduan menampilkan batas ini.
- Sumber meja laundry tidak bisa digandakan melalui order jurnal/manual receipt atau dibalik dengan reversal generik. Koreksi harus menjaga jejak kejadian sumber.
- Pengujian memakai data fiktif dalam SQLite/PGlite lokal, objek bukti dan Auth tiruan. Tidak membuat akun/order/pembayaran percobaan di produksi. Belum ada QA ponsel/kamera/akun pelanggan nyata dalam perubahan ini.

## Implementasi

`server/laundry-journal.mjs` memberi proyeksi hanya-baca dan revisi sinkron terpisah. `server/laundry-finance.mjs` memberi kandidat unik serta pemeriksaan sumber saat posting/Final. `dist/laundry-guide*.js` dan `laundry-scenarios.js` memberi checklist dan panduan. Proyeksi tidak disalin ke `operations.orders`, sehingga importer lama tidak menghasilkan transaksi kedua.

Seluruh suite proyek dijalankan pada Node.js 24; CI menjalankan tes yang sama tanpa deployment atau akses data produksi. Tidak ada perubahan skema atau kredensial pada rilis panduan ini.

## Bahasa antarmuka dan akun tim

Lini masa menampilkan aktivitas, nama petugas dan waktu. Nomor pesanan tetap tersedia untuk penelusuran; kode transaksi internal tidak dipakai sebagai judul aktivitas. Pembayaran/setoran/pengembalian dana menggantikan singkatan teknis pada tampilan utama. Panduan skenario memakai bahasa Indonesia sehari-hari.

Pendaftaran, konfirmasi kode, dan login mempunyai hitungan percobaan per email yang terpisah, dengan batas jaringan bersama tetap berlaku. Formulir tidak valid tidak menghabiskan jatah percobaan. Pengiriman ulang konfirmasi memakai jalur resend Supabase dan tidak membuat akun, sesi atau peran baru. Waktu tunggu ditampilkan bila layanan mengembalikannya.

Kuota pengiriman email Supabase tetap berlaku. Jika layanan menolak karena batas email, periksa [pengiriman email proyek](https://supabase.com/docs/guides/auth/auth-smtp) dan [batas layanan](https://supabase.com/docs/guides/auth/rate-limits). Tidak ada perubahan SMTP atau penonaktifan verifikasi email pada pembaruan ini. Koneksi MCP/skill Supabase di ChatGPT sudah tersedia; tidak diperlukan konfigurasi Claude.

## Pembaruan bahasa antarmuka

Riwayat profil, penghuni, laporan, penilaian, dan pengaturan lama dirangkum saat ditampilkan tanpa menulis ulang bukti asli. Perubahan baru menyimpan kalimat kegiatan singkat dan rincian sebelum/sesudah secara terpisah. Linimasa, jejak keuangan, rincian transaksi, dan laporan unduhan menggunakan nama kegiatan serta nomor pesanan/nota yang berguna, bukan identitas akun atau kunci sumber internal.

Formulir kebijakan memakai nama bagian usaha, pilihan waktu setempat, dan pemilih tanggal libur. Identitas bagian usaha lama tetap dipertahankan saat namanya diubah. Tampilan linimasa pada layar kecil memakai kartu kegiatan; warna kertas, tinta, biru pastel, tipografi dan tanda status mengikuti referensi visual yang diunggah kembali.

Regresi diuji untuk catatan lama yang lengkap/rusak, nama profil baru, bukti sebelum/sesudah, identitas petugas, nomor pesanan, label status, dan penyimpanan kebijakan. Tidak ada perubahan data operasional atau skema dalam perbaikan bahasa ini.


## Meja kerja dan unggahan lebih ringkas

Satu bagian **Kerjakan sekarang** menampilkan tindakan utama untuk peran dan tahap pesanan. Ringkasan semua langkah, rincian pesanan, bukti, laporan, dan panduan kondisi khusus memakai bagian yang dapat dibuka sesuai kebutuhan. Pembayaran/setoran tetap wajib ketika ada dana yang harus diselesaikan; persetujuan harga tidak dianggap selesai hanya karena petugas memulai proses dengan alasan.

Foto dapat diambil langsung dalam formulir tindakan, termasuk identifikasi barang oleh Owner. Unggahan yang berhasil menambahkan metadata bukti dari respons server tanpa meminta seluruh detail pesanan lagi. Berkas galeri/PDF tetap asli; foto kamera dibatasi pada sisi terpanjang 1920 piksel, tanpa memperbesar gambar kecil. Pemilihan bukti tetap divalidasi oleh server berdasarkan pesanan dan jenis pengambilan.

Kemajuan pengiriman dibedakan dari konfirmasi tersimpan. Klik berulang dan pengiriman tindakan ditahan selama penyiapan/unggahan foto. Setelah waktu tunggu habis, pengguna diminta memeriksa daftar bukti sebelum mengirim ulang; tidak ada pengulangan otomatis. Batas waktu lebih panjang hanya berlaku untuk pengiriman bukti. Pembaruan latar tetap aktif, tetapi tidak mengganti tampilan detail jika datanya sama dan berhenti sementara ketika formulir/kamera/unggahan digunakan.

Pembacaan PostgreSQL terkait digabung dalam transaksi baca: detail pesanan, workspace/anggota, serta pesanan/riwayat jurnal. Pengambilan bukti untuk usulan laporan menghindari referensi kosong dan berulang. Transaksi penulisan, pemeriksaan akun, batas akses, revisi dan pemeriksa independen tetap berlaku. Ini mengurangi perjalanan ke database; bukan jaminan waktu unggah tertentu pada setiap jaringan.

Regresi mencakup dokumen asli, kemajuan vs konfirmasi simpan, kegagalan/waktu tunggu, ukuran kamera, satu bagian kerja utama, panduan 28 skenario, unggahan ganda/perpindahan pesanan, metadata bukti privat, dan seluruh alur laporan di SQLite serta PostgreSQL lokal. Pengujian tampilan berbasis DOM tiruan; pemeriksaan visual browser tidak tersedia pada lingkungan rilis ini.
