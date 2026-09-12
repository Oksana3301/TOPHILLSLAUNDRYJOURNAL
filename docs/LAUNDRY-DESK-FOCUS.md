# Meja laundry: satu tindakan utama

Perubahan ini menyiapkan halaman Meja Laundry yang mengikuti kondisi pesanan dan peran akun. Dokumen ini menjelaskan perubahan source; status penerbitan website harus diperiksa terpisah.

## Cara memakai

1. Pilih pesanan dari antrean.
2. Ikuti bagian **Kerjakan sekarang**. Tombol utama membuka hanya isian untuk langkah tersebut.
3. Jika tertulis **Menunggu Owner**, pekerjaan berikutnya memerlukan akun Owner. Operator tidak perlu mengisi langkah tersebut.
4. Buka **Rincian & bukti** atau **Riwayat** jika perlu memeriksa informasi. Keduanya bukan daftar wajib.
5. Gunakan **Tindakan lain bila diperlukan** untuk koreksi, kendala, atau catatan pemeriksaan. Panduan lengkap 28 skenario tetap tersedia dari antrean.

## Catatan yang sudah selesai atau dibatalkan

- INT yang sudah terhubung menampilkan **Buka pesanan lanjutan**. Tidak ada pembayaran atau proses laundry kedua pada INT.
- Pesanan batal tidak menampilkan instruksi menimbang, mencuci, atau memasang label sebagai pekerjaan baru.
- Jika pesanan batal masih memiliki kendala label/kepemilikan dan bukti pengembalian belum tercatat, Owner dapat **Lengkapi bukti pengembalian**. Bukti pesanan, nama penerima, dan alasan wajib. Waktu pencatatan disimpan; sistem tidak mengarang waktu penyerahan fisik.
- Bukti tambahan tidak menutup kendala secara otomatis. Owner kemudian memeriksa dan menyelesaikan catatan kendala melalui langkah berikutnya.
- Tidak ada pembayaran, setoran, pengembalian dana, atau fakta produksi yang diperbarui oleh proses penerbitan ini.

## Akses pelanggan

- Hanya Owner dapat membuat tautan pelanggan untuk THL; INT tidak mempunyai tautan pelanggan.
- Respons pesanan dibantu Operator tidak mengandung tautan pelanggan.
- Akun Operator/Finance yang sedang masuk ditolak pada akses pesanan, bukti, dan tindakan pelanggan.
- Owner dapat memeriksa tampilan pelanggan dalam mode baca. Perubahan tetap dilakukan melalui Meja Laundry menggunakan kewenangan akun.
- Pelanggan tetap memakai tautan pribadinya. Tautan yang pernah disalin sebelum pembaruan masih merupakan kredensial pembawa dan dapat dipakai tanpa sesi staf. Owner perlu mengganti tautan lama yang sudah diketahui pihak lain dan menyampaikan tautan pengganti kepada pelanggan yang sah. Pembaruan ini tidak mengganti tautan produksi secara massal.
- Membuat tautan baru membatalkan tautan pelanggan sebelumnya; pengaruh tersebut ditampilkan sebelum tombol digunakan.

## Tampilan dan pemeriksaan

Identitas merek jurnal dan Meja Laundry memakai markup yang sama dan stylesheet bersama. Halaman ponsel memakai satu kolom, tombol utama setinggi minimal 52 px, isian 16 px, serta rincian dalam dialog yang dapat digulir.

Pengujian otomatis mencakup jalur INT yang terhubung, pesanan batal, bukti pengembalian tambahan, batas peran, pratinjau Owner, pengiriman foto, serta pemilihan langkah pembayaran. Seluruh kelompok tes dijalankan pada Node.js 24 melalui workflow CI yang sudah ada; tidak ada deployment atau akses data produksi dari CI.

Pemeriksaan visual pada ponsel nyata dan penerbitan Sites masih memerlukan lingkungan pengerjaan yang dapat dibuka. Jangan menyatakan perubahan sudah live hanya karena source telah dipush ke GitHub.
