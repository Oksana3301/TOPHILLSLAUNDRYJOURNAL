# Top Hills & Co — Laundry Journal

Source website Top Hills: dashboard laundry/hunian, laporan keuangan, portal QR kamar, dan akun staf. Paket awal berasal dari source versi website 8 (`edcc95b926546225f03323c44b65d6af7a5ae0cf`) beserta dokumen unggahan pengguna. Ruang latihan sudah ditutup pada runtime Supabase.

**Website versi 11 sudah memakai PostgreSQL/Storage Supabase. Pemindahan seluruh 18 tabel sudah terverifikasi. Hasil pemeriksaan dan percobaan akun nyata yang masih diperlukan dicatat dalam [handoff migrasi](docs/supabase/MIGRATION-HANDOFF.md).**

Website saat ini: [Top Hills & Co](https://top-hills-co-journal.atikadewi.chatgpt.site).

## Isi repository

| Folder / file | Isi |
|---|---|
| `dist/` | HTML, CSS dan JavaScript frontend yang memang ditulis sebagai source |
| `dist/assets/` | Ilustrasi keranjang laundry asli dan bukti PDF latihan |
| `server/` | Worker API, aturan alur laundry, keuangan, otorisasi dan sesi |
| `db/schema.ts` | Definisi 18 tabel D1 yang dipakai aplikasi |
| `supabase/` | Skema PostgreSQL lengkap dan Edge API untuk runtime aktif |
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

## Update melalui ChatGPT dan GitHub

Repository utama: [Oksana3301/TOPHILLSLAUNDRYJOURNAL](https://github.com/Oksana3301/TOPHILLSLAUNDRYJOURNAL), branch `main`. Setiap permintaan perubahan pada proyek ini mengikuti alur **fetch → pull → update dan periksa → commit → push → verifikasi**. Baca [panduan sinkronisasi](docs/GIT-WORKFLOW.md) dan [aturan kerja asisten](AGENTS.md). Alur ini dijalankan saat proyek dikerjakan; push GitHub tidak menerbitkan website atau memigrasikan database.

## Menjalankan pemeriksaan lokal

Runtime pengujian paket ini: Node.js 24.19.0. Tes memakai `node:sqlite`. Dari root repository:

```bash
npm ci
npm run build
npm test
npm run test:laundry
npm run test:auth
npm run test:supabase
npm run build:supabase
npm run test:postgres
node --test tests/cache-tests.mjs
```

Build menghasilkan Worker ESM di `dist/server/index.js`. Runtime aktif memilih `DATA_BACKEND=supabase` dan meneruskan API ke Edge backend dengan kredensial server. PostgreSQL dan Storage privat menyimpan data; lingkungan identitas Sites tetap mendukung login ChatGPT. Binding D1/R2 lama dipertahankan untuk pemulihan yang terkendali. Proyek ini belum menyertakan development server umum; membuka HTML saja tidak menjalankan API.

**GitHub Pages tidak menjalankan backend aplikasi ini.** Push source ke GitHub bukan deployment dan tidak mengubah koneksi database atau website aktif.

## Halaman aplikasi

- `/`: dashboard, hunian, collection, jurnal dan tiga laporan keuangan.
- `/laundry-desk`: antrean petugas, Assisted Check-in, bukti, INT/THL, settlement dan review shift.
- `/checkin`: portal pelanggan dari QR kamar, atau tautan pelacakan order pribadi.
- `/login`: login/daftar staf melalui Supabase Auth atau identitas ChatGPT yang sudah ada. Pengiriman kode email dan login akun nyata masih perlu diperiksa.
- `/demo` dan `/sop-demo.html`: ditutup pada runtime Supabase; fixture lokal tetap tersedia untuk pengujian.
- `/sop-coverage`: audit 28 skenario SOP, termasuk keterbatasan.

Tidak ada database operasional, dump akun, file bukti customer, `.env`, key, token sesi, atau QR kamar aktif yang diekspor dalam paket ini. Kredensial yang tampak pada test/demo adalah fixture fiktif, bukan kredensial produksi.

## Supabase: baca sebelum menghubungkan

1. [Handoff migrasi terkini](docs/supabase/MIGRATION-HANDOFF.md): ruang lingkup PostgreSQL/Storage dan dependensi identitas.
2. [Aktivasi Supabase Auth](AUTH-SETUP.md): email/password dan sesi perangkat; bukan migrasi database.
3. [Audit SOP v0.4](SOP-V04-RELEASE-AUDIT.md): apa yang sudah/belum diimplementasikan.
4. [Implementasi laporan](FINANCE-IMPLEMENTATION.md): kontrol dan batas modul keuangan.
5. [Proyek Supabase dan hasil pemeriksaan koneksi](docs/supabase/PROJECT-CONNECTION.md): tujuan `dkiqgwziefazwrcieavq`, konektivitas Auth/Data/Storage yang terverifikasi, hasil SQL dan alat pemeriksaan lokal. Tidak ada key asli dalam repo.

`dist/resources/Supabase-Schema.sql` merupakan **blueprint lama tiga tabel**, belum migrasi lengkap untuk versi 8. Jangan menjalankannya dengan asumsi seluruh laundry, akun, bukti dan jurnal akan langsung tersambung. Skema lengkap berada di `supabase/schema.sql`; backend terproteksi, Storage privat dan pengujian PostgreSQL tersedia.

Saat berpindah host, jangan mempercayai header `oai-authenticated-user-*` dari internet. Fallback identitas ini hanya aman di belakang gateway Sites yang terpercaya; ganti/verifikasi jalur identitas sebelum memakai host lain.

## Status pengujian dan kesiapan

Source runtime Supabase lolos seluruh suite Node.js 24, termasuk 62 skenario API terhadap PostgreSQL lokal dan 15 pemeriksaan koneksi/batas backend. Penyimpanan privat dan API runtime sudah diperiksa. Belum dilakukan pengujian ponsel/kamera nyata, email Supabase nyata, QRIS atau WhatsApp provider. Audit SOP awal: 18 skenario inti tersedia, 8 sebagian, 2 integrasi belum aktif. Ini belum pernyataan siap operasional penuh.

Migrasi mempertahankan data, ID akun, revisi dan histori. Backup penuh disimpan secara privat; repo publik tidak menyimpan data usaha. Sumber D1/R2 tidak dihapus. Setelah ada penulisan baru di Supabase, pemulihan harus merekonsiliasi perubahan tersebut.

## Pembaruan meja laundry

Lihat [paket ganda, koreksi timbangan, dan pengecualian proses](docs/LAUNDRY-PACKAGES.md) untuk alur operator dan pelanggan. Status migrasi Supabase tetap dicatat terpisah pada handoff database.
