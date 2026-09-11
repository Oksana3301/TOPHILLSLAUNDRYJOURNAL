# Handoff database Supabase — Top Hills

Tanggal: 11 September 2026. Kondisi yang dijelaskan berasal dari source website versi 8.

**Status: belum ada adapter PostgreSQL/Storage aktif.** Menambahkan project URL dan API key tidak mengganti D1/R2. Tidak ada data usaha yang diekspor atau diimpor oleh paket source ini.

## Dua pekerjaan berbeda

| Pekerjaan | Sudah ada | Masih perlu |
|---|---|---|
| Supabase Auth | Email/password, OTP, reset, sesi terenkripsi, pencabutan sesi | Project URL/publishable key, email provider, konfigurasi secret runtime dan uji nyata |
| Supabase Database | Blueprint lama untuk workspace/members/mutations | Skema PostgreSQL lengkap, adapter runtime, transaksi/RPC, migrasi dan validasi |
| Supabase Storage | Kontrak API bukti saat ini memakai R2 | Private bucket, akses terbatas, salin byte bukti, relasi metadata dan cleanup |

## Cakupan data aktif

Sumber otoritatif adalah `db/schema.ts` dan migrasi `drizzle/`:

| Kelompok | Tabel saat ini |
|---|---|
| Workspace/akun | `workspace`, `members` |
| Keuangan | `finance_transactions`, `journals`, `journal_lines`, `attachments`, `finance_records`, `finance_audit`, `mutations` |
| Laundry | `laundry_rooms`, `laundry_orders`, `laundry_counters`, `laundry_events`, `laundry_proofs`, `laundry_mutations` |
| Sesi/limit | `staff_sessions`, `auth_limits` |
| Latihan | `laundry_demo_sessions` |

Total 18 tabel. Beberapa record menyimpan JSON terstruktur; jangan kehilangan status PAY/SET/REF, attempt pembayaran, revision history, bukti, pelaku dan sumber order saat dinormalisasi.

Blueprint `dist/resources/Supabase-Schema.sql` hanya memuat `workspaces`, `members`, `mutations` versi rancangan awal. Simpan sebagai referensi; ia belum menggantikan 18 tabel ini.

## Kontrak yang wajib dipertahankan

- ID kamar/order/akun dan referensi THL/PAY/SET/REF tetap, termasuk ID yang dibatalkan.
- Pembaruan memakai compare-and-swap revision: tepat satu penulis berhasil untuk revisi yang sama.
- Kunci mutasi unik dan hash payload mencegah retry menggandakan transaksi. Nomor server tidak dapat digunakan ulang.
- Perubahan order, event audit dan pencatatan idempotensi berada dalam satu transaksi database.
- Approval Owner/Finance dan pemisahan penerima uang/pemeriksa diterapkan oleh server; browser tidak mengirim peran yang dipercaya.
- Customer token hanya memberi akses ke kamar/order yang diizinkan, bukan daftar order umum atau bukti bank.
- Demo tetap berada di penyimpanan terpisah dari usaha; expiry dan batas kapasitas tetap berlaku.
- Setiap laporan keuangan tetap berasal dari jurnal yang sama, dengan bukti, tanggal akuntansi, waktu kejadian dan jejak perubahan.

## Area kode yang perlu diubah

| File | Kebutuhan migrasi |
|---|---|
| `server/worker.mjs` | Workspace, members, finance, authorization dan penulisan atomik |
| `server/laundry-api.mjs` | Room/order/proof/event/counter/mutation dan query filter |
| `server/laundry-finance.mjs` | Pembacaan order ke usulan laporan, unik berdasarkan sumber |
| `server/staff-auth.mjs` | Sesi terenkripsi, lease refresh token dan rate limiting |
| `server/laundry-demo-api.mjs` | Ruang demo, revision, expiry dan limit |
| `server/reset-business.mjs` | Batas reset, preservation akun dan cleanup file |

Ganti `.prepare/.bind/.first/.all/.run/.batch`, `INSERT OR IGNORE`, `json_extract/json_each` serta `meta.changes` dengan operasi PostgreSQL/RPC yang mempunyai jaminan transaksi setara. Jangan mengganti query menjadi beberapa request HTTP terpisah jika sebelumnya harus atomik.

Worker saat ini memerlukan akses database melalui API HTTPS; jangan mengasumsikan URL Postgres TCP bisa dimasukkan begitu saja. Pilih kontrak RPC terbatas atau backend yang memegang transaksi database, dan jangan membuat endpoint SQL/RPC bebas dari browser.

## Identitas, secret, dan host

- ID ChatGPT dan `sb:<uuid>` Supabase merupakan identitas berbeda. Tidak ada penggabungan otomatis berdasarkan email.
- Auth yang sudah disiapkan masih memakai D1 untuk membership, sesi terenkripsi dan limit. Mengaktifkan Supabase Auth saja tetap memerlukan D1.
- `.env.example` hanya mencantumkan nama pengaturan yang memang didukung adapter Auth. File ini tidak otomatis dimuat oleh Worker.
- `AUTH_SESSION_KEY` aktif disimpan di runtime, tidak dalam repo. Saat memindahkan sesi, pertahankan secret dengan aman atau invalidasi semua sesi dan minta login ulang; jangan menyalin ciphertext tanpa rencana key.
- Jika backend memakai service-role/secret key untuk DB/Storage, simpan hanya di server. RLS tidak menggantikan proyeksi dan otorisasi di API saat memakai hak server.
- Supabase publishable/anon key tidak memberi hak membuat Owner atau membaca data usaha umum.
- Di host selain Sites, verifikasi/ganti identitas platform. Header `oai-authenticated-user-*` dari pengunjung tidak boleh dipercaya.
- `.openai/hosting.json` menunjuk Site yang sudah ada. Pertahankan untuk workflow Sites; jangan menggunakannya untuk tanpa sengaja membuat/mengganti Site lain.

## Urutan cutover

1. Selesaikan skema, adapter dan pengujian pada project uji dengan data fiktif.
2. Cadangkan database serta byte semua bukti. Paket GitHub berisi source, bukan cadangan data usaha.
3. Bekukan penulisan dalam jendela migrasi yang disepakati.
4. Salin record dengan ID/revisi/audit tetap dan bukti ke private Storage; validasi jumlah, hash dan relasi.
5. Cocokkan kas, neraca/jurnal, piutang, PAY/SET/REF, order terbuka, INT dan barang dalam custody.
6. Uji dua penulis bersamaan, respons hilang, revoke role/sesi, token palsu dan file lintas customer.
7. Aktifkan tepat satu sumber data; jangan fallback diam-diam ke D1 ketika Supabase gagal.
8. Buka penulisan setelah validasi. Rollback setelah ada transaksi baru wajib merekonsiliasi transaksi yang sudah masuk.

Belum ada langkah cutover, perubahan runtime secret, perubahan schema produksi, atau data pelanggan yang dijalankan dalam handoff ini.
