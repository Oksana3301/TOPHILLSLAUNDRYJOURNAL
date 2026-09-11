# Paket ganda dan meja kerja laundry

Perubahan 11 September 2026. Alur ini memakai API dan penyimpanan order yang sama; tidak membuat salinan order dalam browser.

## Cara kerja

1. Pelanggan memilih satu atau beberapa paket saat check-in. Pilihan sama tersedia pada check-in dibantu petugas.
2. Petugas menerima pesanan/revisi, mencatat barang dan label, lalu membuka **Isi / koreksi timbangan**. Setiap paket memiliki berat atau jumlah tersendiri. Paket dapat ditambah atau dikeluarkan sebelum proses berjalan.
3. Rincian menghitung harga dan minimum setiap paket secara terpisah. Barang yang sama tidak boleh ditimbang untuk dua paket. Layanan per load membulatkan jumlah load, layanan satuan memakai jumlah barang bulat.
4. Pelanggan menyetujui rincian melalui tautan order, atau petugas mencatat persetujuan dengan bukti. Koreksi timbang sebelum ada penerimaan uang membatalkan persetujuan dan permintaan pembayaran lama. Rincian sebelumnya, bukti, pelaku, waktu dan alasan koreksi tetap tersimpan.
5. Bila pelanggan belum merespons, Owner/Operator dapat memilih **Lanjut dengan alasan**. Wajib mengisi kondisi, alasan minimal 20 karakter, pernyataan tanggung jawab, nomor mesin dan label order yang cocok. Identitas, revisi terbaru, barang, label, foto timbang, serta kebijakan wajib lunas dari Owner tetap diperiksa.
6. Pengecualian mengizinkan pekerjaan dan QC. Persetujuan harga tetap menunggu pelanggan: pengecualian tidak menghasilkan persetujuan, pembayaran, atau serah terima otomatis. Setelah persetujuan tercatat, peringatan terkait ditutup dan jejak pengecualian dipertahankan.

Tidak ada ambang jam universal yang dipaksakan: kondisi pelanggan sibuk, instruksi langsung, dan menunggu lama memerlukan penjelasan yang tercatat. Waktu sejak harga terakhir ditetapkan ikut disimpan.

## Data dan kompatibilitas

- `customer.serviceIds`: daftar ID paket unik; `serviceId` tetap memuat paket pertama untuk kompatibilitas order lama.
- `price.lines`: snapshot layanan, berat, jumlah tagihan dan total per paket. `price.total` adalah total seluruh paket.
- `priceHistory`: rincian sebelum koreksi, bukti, persetujuan terdahulu dan petugas yang mengoreksi.
- `priceApproval`: pelaku, waktu, versi harga dan sumber persetujuan.
- `processAuthorization`: pelaku pengecualian, alasan, kondisi, versi harga/pesanan dan lama menunggu.
- Portal pelanggan hanya menerima rincian pengecualian yang diperlukan, bukan identitas internal akun atau catatan keuangan.

Contoh input timbang: `lines: [{serviceId: 'THL-regular-refresh', weight: 3}, {serviceId: 'THL-bed-cover-l', quantity: 1}]` menghasilkan Rp53.000 sesuai katalog saat perubahan ini dibuat.

## Tampilan

Portal dan meja kerja mengikuti referensi Nurio yang diberikan: kertas ivory dengan grid 16 px, Patrick Hand Regular untuk judul, Inter untuk data, tombol powder blue berteks ink. Font dilayani dari website sendiri. Hijau menyatakan kondisi beres; merah menunjukkan masalah; kuning menunjukkan hal yang ditunggu. Status memakai label dan ikon, sehingga tidak bergantung pada warna saja.

## Verifikasi dan batas penerapan

Pengujian memakai Node.js 24 dan penyimpanan lokal fiktif: gabungan paket, minimum, koreksi harga, konflik revisi, retry, audit pengecualian, batas peran, persetujuan pelanggan dan pembayaran. GitHub Actions menjalankan seluruh skrip tes dan build tanpa secret atau deployment.

Ini belum merupakan migrasi Supabase. Aktivasi database/Storage baru, pemindahan data, verifikasi produksi, dan penghapusan ruang latihan menunggu penyelesaian tahap migrasi pada `docs/supabase/MIGRATION-HANDOFF.md`. Kode baru tidak mengklaim Supabase aktif hanya karena plugin sudah terhubung.
