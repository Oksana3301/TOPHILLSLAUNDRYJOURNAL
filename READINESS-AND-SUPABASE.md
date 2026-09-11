# Top Hills & Co — Persiapan Supabase dan operasional

Status: rancangan migrasi, 10 September 2026. **Belum terhubung ke Supabase.** Database aktif adalah D1; file bukti transaksi menggunakan R2. Website tetap di URL ChatGPT yang sudah ada. Dokumen dan SQL ini tidak mengubah koneksi aplikasi.

## Yang sudah berjalan

- Identitas login ChatGPT diteruskan oleh platform ke server. Browser tidak menentukan sendiri identitas atau hak Owner.
- Akun Owner, Finance, Operator, dan Konsumen memiliki pemeriksaan akses di server. Konsumen tanpa profil yang sah menerima daftar kosong.
- Revisi data diperiksa saat menyimpan. Dua perangkat yang menyimpan revisi sama tidak dapat saling menimpa diam-diam.
- Permintaan yang dikirim ulang memakai ID dan hash permintaan yang sama, termasuk endpoint, untuk menghindari pencatatan ganda.
- Sinkronisasi diperiksa setiap 15 detik saat halaman aktif, saat kembali fokus, dan saat koneksi pulih. Formulir terbuka tidak diganti oleh penyegaran otomatis. Koneksi internet diperlukan saat menyimpan.
- Jurnal mempunyai filter tanggal dan jam WIB. Waktu order baru, penyelesaian, dan pengiriman laporan ditetapkan saat diterima server. Tanggal akuntansi dan waktu pencatatan adalah dua hal berbeda.
- File transaksi berada di penyimpanan privat, dengan validasi ukuran/jenis dan hash isi. Unduh melewati pemeriksaan hak akses.
- Inisialisasi ruang kerja baru tidak memasukkan data contoh. Reset yang diminta Owner mengosongkan data usaha serta file bukti; akun tetap dipertahankan dan revisi tidak diulang dari nol.

## Pilihan database

Supabase memungkinkan. Gunakan Postgres sebagai pengganti D1 melalui API HTTPS dan simpan file dalam bucket privat Supabase Storage, atau pertahankan R2 dahulu agar migrasi dapat bertahap. Situs ini tidak mendukung koneksi database TCP mentah.

Arsitektur yang direncanakan:

Browser → login ChatGPT / API Top Hills → otorisasi server → Supabase Postgres.
File bukti → API Top Hills → private Storage atau R2.

Login ChatGPT bukan otomatis sesi Supabase Auth. Jangan membuat kebijakan `auth.uid() = id_ChatGPT` atau menghubungkan akun hanya karena alamat email cocok. Pertahankan ID akun saat migrasi. Supabase Auth merupakan perubahan autentikasi terpisah; dukungannya pada beberapa perangkat tidak otomatis menghubungkan akun website ini.

## Yang perlu disiapkan Owner

1. Project Supabase milik Anda dan Project URL dari pengaturan proyek. URL proyek boleh diberikan untuk menyiapkan koneksi.
2. Secret key server dari pengaturan API Keys. **Jangan kirim key ke chat, HTML, Git, atau browser.** Pengisian rahasia dilakukan pada environment server yang aman setelah jalur akses pengaturannya tersedia.
3. Pengelola teknis yang dapat menjalankan SQL dan memverifikasi izin proyek.
4. Jadwal migrasi pendek saat tidak ada input data, serta cadangan lengkap sebelum perpindahan.

Nama konfigurasi yang direncanakan untuk adapter adalah `SUPABASE_URL` dan `SUPABASE_SECRET_KEY`. Menambahkan dua nilai saja belum menyambungkan versi aplikasi ini: adapter runtime dan pengujian proyek harus diselesaikan terlebih dahulu. Jangan mengganti provider sebelum semua gerbang migrasi lulus.

## SQL yang disertakan

`Supabase-Schema.sql` adalah blueprint untuk skema privat dan RPC terbatas. Ia belum diuji terhadap proyek Supabase Anda. Tidak ada secret atau data pelanggan di dalam file. Tabel memakai RLS dan hak akses normal ditutup; RPC hanya untuk server. Jangan memasukkan skema privat ke exposed schemas.

Secret key server memiliki hak tinggi dan dapat melewati RLS. Karena itu RLS tidak menggantikan pemeriksaan aktor, peran, dan proyeksi data di server. Ikuti kontrak RPC pada file SQL; jangan mengekspos endpoint proxy yang menerima RPC atau SQL bebas dari browser.

## Urutan perpindahan

1. Jalankan dan tinjau blueprint dalam lingkungan uji; selesaikan adapter runtime yang sesuai dengan kontrak RPC.
2. Uji konektivitas HTTPS dari server Sites. Jangan menaruh secret dalam bundle frontend.
3. Hentikan penulisan sementara. Ekspor state terakhir setelah reset, daftar akun beserta ID, revisi, dan daftar lampiran. Jangan impor ulang data contoh sebelum reset.
4. Impor secara atomik, pertahankan pemilik dan akun; naikkan revisi saat cutover agar perangkat lama tidak menulis state sebelum migrasi.
5. Bandingkan jumlah/ID akun, hash state, jurnal seimbang, dan file bukti. Jika memindahkan file, gunakan Storage API, kemudian cocokkan ukuran/hash.
6. Aktifkan satu provider saja setelah uji lulus. Bila Supabase tidak dapat dihubungi, tampilkan kegagalan; jangan diam-diam menyimpan ke D1.
7. Uji dua perangkat dan semua peran pada proyek yang sebenarnya, lalu izinkan input kembali.
8. Rollback setelah transaksi baru masuk perlu menyalin perubahan kembali. Mengganti koneksi saja dapat menghilangkan transaksi terbaru.

## File dan reset

Database dan byte Storage bukan satu transaksi. Jika metadata sudah dihapus tetapi penghapusan file gagal, antrekan cleanup harus tetap ada dan dapat diulang. Jangan menghapus baris `storage.objects` lewat SQL: penghapusan file harus melalui Storage API. Bucket bukti harus privat, dengan batas 10 MB dan tipe JPG/PNG/PDF. URL file publik tidak dipakai untuk bukti.

## Gerbang sebelum penggunaan operasional

- Karyawan, akun terkait, paket, tarif, float, batas kas, dan rentang nomor telah disiapkan.
- Kebijakan akuntansi dan saldo awal disahkan Owner.
- Tersedia pemeriksa berbeda untuk review dan rekonsiliasi; akses situs tim diberikan hanya kepada orang yang dipilih Owner.
- Mutasi bank dan bukti diperiksa secara independen. Tidak ada pembayaran nyata atau penarikan mutasi otomatis di aplikasi ini.
- Pemulihan cadangan diuji. JSON saat ini memuat data/metadata, bukan byte lampiran; unduh dan simpan file bukti secara terpisah. Pemulihan penuh belum satu klik.
- Sebagian bukti operasional laundry masih berupa checklist simulasi. Prosedur atau implementasi file bukti tahap laundry perlu dilengkapi sebelum penggunaan nyata.
- Generator Draft berjalan saat situs diakses; jadwal tanpa membuka situs belum aktif.
- Aktifkan MFA di akun ChatGPT dan keluar dari perangkat bersama. Uji pencabutan akses, jangan berbagi satu akun antarpegawai.

## Uji penerimaan

| Uji | Hasil yang diwajibkan |
|---|---|
| Dua perangkat menyimpan revisi sama | Tepat satu perubahan berhasil; lainnya diminta meninjau versi baru |
| Respons hilang setelah commit | Retry hanya menghasilkan satu transaksi |
| ID permintaan sama, endpoint/isi berbeda | Ditolak |
| Akun nonaktif atau menunggu | Tidak dapat membaca data maupun menyimpan |
| Konsumen tanpa tautan | Tidak menerima order umum atau data orang lain |
| Operator mengubah evaluasi/akses Owner | Ditolak server |
| Supabase publishable key membaca tabel/RPC privat | Ditolak |
| Reset dan perangkat lama | Akun tetap ada, usaha kosong, stale write ditolak |
| Gagal menghapus byte bukti | Data tidak dapat diakses; cleanup dapat diulang |
| Jurnal 08.00–09.00 WIB | Menyertakan 08.00.00 sampai 09.00.59.999 WIB |
| Cadangan dipulihkan | ID, saldo, relasi, dan hash semua file cocok |

## Referensi resmi

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design)
- [Supabase third-party authentication](https://supabase.com/docs/guides/auth/third-party/overview)
- [OpenAI MFA](https://help.openai.com/en/articles/7967234-enabling-or-disabling-multi-factor-authentication-mfa)
