# Top Hills & Co — Laundry Journal

Source website Top Hills: dashboard laundry/hunian, laporan keuangan, portal QR kamar, akun staf, dan ruang latihan terisolasi. Paket ini berasal dari source versi website 8 (`edcc95b926546225f03323c44b65d6af7a5ae0cf`) beserta dokumen unggahan pengguna.

**Database aktif masih Cloudflare D1, bukti file di R2. Supabase Auth sudah memiliki adapter, tetapi belum dikonfigurasi. Database usaha belum dimigrasikan ke Supabase.**

Website saat ini: [Top Hills & Co](https://top-hills-co-journal.atikadewi.chatgpt.site).

## Isi repository

| Folder / file | Isi |
|---|---|
| `dist/` | HTML, CSS dan JavaScript frontend yang memang ditulis sebagai source |
| `dist/assets/` | Ilustrasi keranjang laundry asli dan bukti PDF latihan |
| `server/` | Worker API, aturan alur laundry, keuangan, otorisasi dan sesi |
| `db/schema.ts` | Definisi 18 tabel D1 yang dipakai aplikasi |
| `drizzle/` | Migrasi SQLite/D1 dan snapshot; jangan ditimpa untuk migrasi PostgreSQL |
| `scripts/` | Build Worker, bundling QR dan skenario demo |
| `tests/` | Pengujian alur, API, finance, akun dan demo |
| `vendor/`, `dist/vendor/` | Library QR/PDF beserta lisensinya |
| `docs/sop/` | SOP v0.2, v0.3, v0.4 terbaru dan arsip unggahan |
| `docs/requirements/` | Requirement Menu Laporan v1.0 |
| `docs/design/` | Referensi visual asli |
| `docs/source-documents.json` | Pemetaan unggahan dan hash salinan dokumen |
| `.env.example` | Nama pengaturan Auth, tanpa nilai rahasia |
| `.openai/hosting.json` | Identitas Site yang sudah ada serta binding DB/BUCKET |

`dist/` tidak boleh dihapus saat membersihkan build: folder ini memuat frontend sumber. Hanya `dist/server/`, `dist/.openai/` dan `.sites-runtime/` yang merupakan output/cache build yang diabaikan Git.

## Menjalankan pemeriksaan lokal

Runtime pengujian paket ini: Node.js 24.19.0. Tes memakai `node:sqlite`. Dari root repository:

```bash
npm ci
npm run build
npm test
npm run test:laundry
npm run test:auth
node --test tests/cache-tests.mjs
```

Build menghasilkan Worker ESM di `dist/server/index.js`. Runtime membutuhkan binding `DB` (D1), `BUCKET` (R2), serta lingkungan identitas Sites untuk fallback login ChatGPT. Proyek ini belum menyertakan development server umum; membuka HTML saja tidak menjalankan API.

**GitHub Pages tidak menjalankan backend aplikasi ini.** Push source ke GitHub bukan deployment dan tidak mengubah koneksi database atau website aktif.

## Halaman aplikasi

- `/`: dashboard, hunian, collection, jurnal dan tiga laporan keuangan.
- `/laundry-desk`: antrean petugas, Assisted Check-in, bukti, INT/THL, settlement dan review shift.
- `/checkin`: portal pelanggan dari QR kamar, atau tautan pelacakan order pribadi.
- `/login`: login/daftar staf; email/password baru aktif sesudah konfigurasi Supabase Auth.
- `/demo`: buat ruang latihan QR dengan nama, bukti dan uang fiktif. Data terpisah dari transaksi usaha.
- `/sop-demo.html`: 20 skenario latihan interaktif menggunakan aturan status yang sama.
- `/sop-coverage`: audit 28 skenario SOP, termasuk keterbatasan.

Tidak ada database operasional, dump akun, file bukti customer, `.env`, key, token sesi, atau QR kamar aktif yang diekspor dalam paket ini. Kredensial yang tampak pada test/demo adalah fixture fiktif, bukan kredensial produksi.

## Supabase: baca sebelum menghubungkan

1. [Handoff migrasi terkini](docs/supabase/MIGRATION-HANDOFF.md): ruang lingkup PostgreSQL/Storage dan dependensi identitas.
2. [Aktivasi Supabase Auth](AUTH-SETUP.md): email/password dan sesi perangkat; bukan migrasi database.
3. [Audit SOP v0.4](SOP-V04-RELEASE-AUDIT.md): apa yang sudah/belum diimplementasikan.
4. [Implementasi laporan](FINANCE-IMPLEMENTATION.md): kontrol dan batas modul keuangan.

`dist/resources/Supabase-Schema.sql` merupakan **blueprint lama tiga tabel**, belum migrasi lengkap untuk versi 8. Jangan menjalankannya dengan asumsi seluruh laundry, akun, bukti dan jurnal akan langsung tersambung. Kontrak API PostgreSQL, migrasi 18 tabel, Storage dan pengujian tetap harus dibuat.

Saat berpindah host, jangan mempercayai header `oai-authenticated-user-*` dari internet. Fallback identitas ini hanya aman di belakang gateway Sites yang terpercaya; ganti/verifikasi jalur identitas sebelum memakai host lain.

## Status pengujian dan kesiapan

Source versi 8 lolos pengujian otomatis lokal untuk finance, akun, alur laundry, API, cache dan 20 skenario demo. Belum dilakukan pengujian ponsel/kamera nyata, email Supabase nyata, QRIS atau WhatsApp provider. Audit SOP: 18 skenario inti tersedia, 8 sebagian, 2 integrasi belum aktif. Ini belum pernyataan siap operasional penuh.

Perubahan handoff GitHub hanya menata dokumentasi, menyertakan SOP/referensi asli dan memperkuat aturan file yang diabaikan Git. Tidak ada reset, pemindahan database, pembayaran, atau publikasi website pada langkah handoff ini.
