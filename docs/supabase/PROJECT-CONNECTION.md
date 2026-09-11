# Koneksi proyek Supabase Top Hills

Pemeriksaan 11 September 2026. Repository: `Oksana3301/TOPHILLSLAUNDRYJOURNAL`.

## Tujuan yang terverifikasi

- Project reference: `dkiqgwziefazwrcieavq`.
- API URL: `https://dkiqgwziefazwrcieavq.supabase.co`.
- Identitas proyek disimpan di `config/supabase-project.json`. File tersebut dipakai alat pemeriksaan; ia tidak mengganti backend Worker.
- Tidak ada publishable key, secret key, password, atau token asli yang disimpan dalam commit ini.

## Hasil pembacaan langsung

Pemeriksaan awal memakai tiga permintaan HTTP GET dari sisi server. Semua menerima HTTP 200:

| Layanan | Hasil yang diamati |
|---|---|
| Auth `/auth/v1/settings` | Email aktif, pendaftaran aktif, konfirmasi email diperlukan; provider sosial dan telepon tidak aktif |
| Data API `/rest/v1/` | Spesifikasi skema `public` menampilkan 0 tabel/view dan fungsi `rls_auto_enable` |
| Storage `/storage/v1/bucket` | Daftar bucket kosong |

Ini membuktikan kedua API key yang diberikan diterima oleh layanan terkait saat pemeriksaan. Ini belum merupakan uji login akun nyata, inventaris seluruh database, pemeriksaan RLS, migrasi data, atau pengujian alur usaha.

Tidak terlihatnya tabel pada spesifikasi Data API tidak cukup untuk menyatakan seluruh database kosong. Skema privat, hak akses tabel, dan konfigurasi Data API tetap perlu diperiksa melalui SQL. Aplikasi sumber memakai 18 tabel D1; lihat [handoff migrasi](MIGRATION-HANDOFF.md).

Pemeriksaan tambahan melalui CLI Node pada lingkungan pengerjaan mengalami kegagalan akses jaringan; pemeriksaan per tabel belum memperoleh hasil langsung yang terverifikasi. Hasil HTTP awal di atas tidak diganti dengan asumsi bahwa API key gagal. Pengujian otomatis alat pemeriksaan memakai layanan tiruan.

## Pemeriksaan berulang dari lingkungan lokal

Gunakan Node.js 24.19 atau lebih baru dan suplai `SUPABASE_PUBLISHABLE_KEY` serta `SUPABASE_SECRET_KEY` melalui environment proses lokal yang aman. `SUPABASE_URL` opsional, tetapi jika diberikan harus cocok dengan proyek di konfigurasi.

```bash
npm run check:supabase
```

Script tersebut:

- Hanya mengirim GET ke host proyek yang ditetapkan; tidak mengikuti redirect.
- Membaca pengaturan Auth, spesifikasi Data API, dan metadata bucket.
- Memeriksa keterjangkauan 18 tabel dengan `limit=0`, tanpa mengambil baris pelanggan atau menghitung record.
- Tidak mencetak key, header permintaan, isi error mentah, atau isi tabel.
- Menolak berjalan jika environment `CI` aktif. GitHub Actions hanya menjalankan `npm run test:supabase` dengan layanan tiruan.
- Menghasilkan exit code 1 bila pemeriksaan koneksi gagal, 2 bila layanan terjangkau tetapi tabel aplikasi belum seluruhnya dapat diakses, dan 0 bila keduanya lulus. Exit code 0 tetap bukan pernyataan migrasi atau kesiapan operasional.

## Langkah SQL yang masih diperlukan

Project API key mengakses layanan data proyek. Management API menggunakan access token atau OAuth tersendiri. Pada sesi pemeriksaan, operasi SQL Supabase belum tersedia melalui plugin, sehingga belum ada migrasi skema yang dijalankan.

Buka SQL Editor proyek `dkiqgwziefazwrcieavq`, buat query baru, dan jalankan [INSPECT-PROJECT.sql](INSPECT-PROJECT.sql). Query ini hanya menampilkan nama skema/tabel, status RLS, dan hak SELECT; tidak membaca isi data pelanggan atau mengubah apa pun. Hasilnya diperlukan untuk memastikan kondisi database sebelum menyusun perubahan skema dan adapter.

Jangan menjalankan blueprint lama `dist/resources/Supabase-Schema.sql` sebagai pengganti migrasi lengkap. Database D1/R2, runtime Auth website, ruang latihan, dan deployment tetap mengikuti urutan cutover dalam handoff.

## Kunci yang dibagikan dalam percakapan

Secret key yang sudah dibagikan perlu diganti melalui Supabase **Settings → API Keys**. Jika kunci lama dipakai aplikasi lain, ganti pemakaiannya lebih dahulu sebelum mencabutnya. Simpan penggantinya pada konfigurasi secret server yang aman, bukan percakapan, GitHub, frontend, atau workflow CI. Publishable key memang ditujukan untuk komponen publik, tetapi tidak memberi akses pengelolaan proyek.

Referensi resmi:

- [Jenis API key dan penanganan secret](https://supabase.com/docs/guides/getting-started/api-keys).
- [Autentikasi Management API](https://supabase.com/docs/reference/api/introduction).
- [Perubahan default akses Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
