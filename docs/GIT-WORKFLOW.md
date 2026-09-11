# Alur update ChatGPT ↔ GitHub

Repository utama: [Oksana3301/TOPHILLSLAUNDRYJOURNAL](https://github.com/Oksana3301/TOPHILLSLAUNDRYJOURNAL), branch `main`.

Mulai 11 September 2026, permintaan update proyek ini melalui ChatGPT mengikuti alur berikut. Aturan untuk asisten juga tersimpan dalam [`AGENTS.md`](../AGENTS.md).

| Tahap | Yang dilakukan |
| --- | --- |
| Periksa | Cek branch, berkas lokal yang berubah, dan koneksi repo. |
| Fetch | Ambil informasi commit terbaru dari GitHub. Berkas kerja belum diubah. |
| Pull | Pada checkout bersih, terapkan perubahan GitHub dengan `--ff-only`. Periksa konflik atau riwayat yang berbeda sebelum melanjutkan. |
| Update | Kerjakan perubahan yang diminta dan jalankan pemeriksaan terkait. |
| Commit | Simpan perubahan yang sudah ditinjau dengan pesan yang menjelaskan isinya. |
| Push | Kirim commit ke GitHub, lalu periksa bahwa branch tujuan sudah memuatnya. |

Perubahan lokal yang belum disimpan harus dipertahankan. Berkas milik pekerjaan lain tidak ikut di-commit. Jika GitHub berubah saat pekerjaan berlangsung, ambil ulang commit terbaru dan gabungkan perubahan yang relevan tanpa menimpa hasil kerja orang lain.

## Menggunakan repo di komputer sendiri

Untuk pengambilan pertama:

```bash
git clone https://github.com/Oksana3301/TOPHILLSLAUNDRYJOURNAL.git
cd TOPHILLSLAUNDRYJOURNAL
git config pull.ff only
git config push.default simple
```

Sebelum mulai bekerja, periksa `git status`. Jika checkout bersih dan branch yang aktif adalah `main`:

```bash
git fetch --prune origin
git pull --ff-only origin main
```

Sesudah perubahan selesai, periksa `git diff`, jalankan tes yang sesuai, lalu pilih berkas yang memang ingin disimpan dengan `git add <path-berkas>`. Periksa hasil staging melalui `git diff --cached`, kemudian:

```bash
git commit -m "Jelaskan perubahan Top Hills"
git fetch origin
git merge --ff-only origin/main
git push origin main
```

Jika `merge --ff-only` menolak karena kedua sisi memiliki commit baru, berhenti untuk memeriksa dan menggabungkan riwayat tersebut. Jangan memakai force push sebagai jalan pintas. Jika push ditolak karena GitHub baru berubah lagi, ulangi pemeriksaan dan penggabungan sebelum mencoba kembali.

Akses baca repo publik bisa berhasil tanpa login; push membutuhkan akun GitHub dengan izin tulis. Koneksi GitHub di ChatGPT dan autentikasi Git di komputer sendiri merupakan dua koneksi yang terpisah.

## Cara melanjutkan melalui ChatGPT

Sebutkan perubahan yang diinginkan, misalnya: "Update filter laporan laundry di repo TOPHILLSLAUNDRYJOURNAL, cek hasilnya, lalu push." Dalam sesi baru, berikan tautan repo agar asisten mengambil source terbaru dan membaca `AGENTS.md`.

Jika terminal ChatGPT tidak mempunyai kredensial Git, push dapat dilakukan melalui koneksi GitHub yang sudah diotorisasi. Setelah branch GitHub diperbarui, checkout lokal di-fetch dan di-pull agar kembali cocok dengan commit yang terbit.

Alur ini berjalan ketika permintaan update sedang dikerjakan. Tidak ada pemantau chat atau sinkronisasi komputer yang berjalan di latar belakang. GitHub menyimpan kode dan dokumen; penerbitan website serta migrasi atau sinkronisasi database adalah pekerjaan tersendiri.

## Isi paket awal

- Sumber: `TOPHILLSLAUNDRYJOURNAL-GitHub-Ready.zip` yang diunggah Atika.
- SHA-256 ZIP: `4ce9e3751a66e6129b22d0791e7a5566c18c549b5a7c3044c6d0b02bf9bafc1f`.
- Paket awal: 116 berkas, termasuk README yang sudah ada di GitHub.
- Tambahan pada impor: `AGENTS.md`, panduan ini, dan tautan panduan dari README.
- Tidak menyertakan `.env` aktif, kredensial, dump database, atau bukti transaksi pelanggan.
