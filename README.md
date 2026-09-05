# RATU Finansial

Website mobile-first untuk materi finansial, kuis dinamis, leaderboard publik Top 5, dan catatan keuangan keluarga. Seluruh aset visual berada di dalam folder `assets`, sehingga tidak lagi bergantung pada lokasi file di luar proyek.

## Navigasi dan catatan keuangan

Bottom navigation berisi Beranda, Materi, Catatan, Kuis, dan Peringkat serta tersedia di seluruh ukuran layar dan seluruh halaman. Maskot kecil pada navbar publik membuka `admin.html`.

Halaman `catatan.html` memakai profil yang dibuat saat kuis pertama. Ibu masuk menggunakan nomor WhatsApp dan PIN 6 digit yang sama; transaksi disimpan pada tab `FinanceTransactions` berdasarkan ID profil acak. Ringkasan bulanan, saldo, persentase uang tersisa, kategori pengeluaran terbesar, dan saran sederhana dihitung otomatis di browser. Catatan lama dari `localStorage` dimigrasikan secara idempoten setelah login berhasil, kemudian salinan lokal dihapus hanya setelah seluruh baris berhasil tersimpan.

## Panel admin

Panel tersedia pada `admin.html` dan mengendalikan periode, jadwal buka/tutup, jumlah soal, isi pilihan jawaban, serta kunci jawaban. Panel juga menampilkan seluruh peserta dan leaderboard lintas periode. Admin dapat mengubah nama, nomor WhatsApp, dan nilai peserta. Penghapusan peserta memakai status `DELETED`, sehingga peserta langsung hilang dari dashboard dan leaderboard tetapi jejak audit tetap tersimpan di spreadsheet.

- Username awal: `ratufinansial`
- Password awal diberikan terpisah kepada pengelola dan hanya hash SHA-256 yang berada di Apps Script.
- Sesi admin berlaku enam jam, tersimpan hanya pada tab browser, dan dapat dicabut dengan tombol **Keluar**.
- Delapan kegagalan login mengunci percobaan selama sepuluh menit.

Ganti password awal sebelum publikasi luas dengan mengganti nilai hash `ADMIN_PASSWORD_SHA256`, lalu deploy versi Apps Script baru.

## Menjalankan website

Jalankan static server dari folder proyek. Halaman utama berada di `index.html`; katalog dan detail materi berada di folder `materi`.

## Spreadsheet yang digunakan

Spreadsheet: `1fIwjxQdN64AH2TS362EHL_G3-QCcjMtqj8c2-lC4QQM`

Tab `QuizResults` memiliki kolom:

`Timestamp | Week | Name | Phone | Community | Score | DurationSeconds | Answers | Consent | Status`

Tab `QuizConfig` dan `QuizQuestions` dibuat otomatis saat API baru pertama kali digunakan. Keduanya dikelola melalui panel admin.

Tab `Profiles` menyimpan ID profil, identitas tersinkronisasi, salt dan hash PIN, serta status profil. PIN mentah tidak disimpan. Tab `FinanceTransactions` menyimpan transaksi berdasarkan ID profil dan memakai soft-delete pada kolom `DeletedAt`.

Urutan leaderboard: nilai tertinggi, durasi tercepat, kemudian timestamp paling awal. Baris berstatus `VALID` dan data lama berstatus `REVIEW` ditampilkan; hasil baru langsung berstatus `VALID`. Baris `DELETED` atau `DISQUALIFIED` tidak ditampilkan.

## Mengaktifkan integrasi Apps Script

1. Buka project Apps Script RATU.
2. Ganti isi `Code.gs` dengan isi `google-apps-script.js`.
3. Klik **Deploy > New deployment > Web app**.
4. Pilih **Execute as: Me** dan akses yang mengizinkan peserta membuka endpoint.
5. Selesaikan otorisasi, lalu salin URL deployment yang berakhiran `/exec`.
6. Tempel URL tersebut ke `CONFIG.apiUrl` pada baris pertama `app.js`.
7. Deploy ulang setelah perubahan Apps Script berikutnya agar website memakai versi terbaru.

Tanpa URL `/exec`, pengiriman kuis dinonaktifkan agar website tidak mengklaim nilai sudah tersimpan.

## Perlindungan data dasar

- Nomor WhatsApp dinormalisasi dan hanya tersimpan di spreadsheet panitia.
- Leaderboard hanya mengirim nama yang disamarkan.
- Satu nomor hanya dapat mengirim satu hasil per minggu.
- Penulisan memakai `LockService` untuk mencegah tabrakan submit.
- Skor dan peringkat dihitung di Apps Script; kunci jawaban tidak dikirim ke browser.
- Input teks dibatasi dan dinetralkan dari formula spreadsheet berbahaya.
- Jawaban, periode, persetujuan, nomor telepon, dan durasi divalidasi di server.
- Maksimal leaderboard publik adalah Top 5 peserta. Panel admin tetap dapat melihat Top 50 lintas periode.
- Panitia dapat mengubah status menjadi `DISQUALIFIED`; hanya status `VALID` yang muncul ke publik.
- Endpoint admin memerlukan token sesi server; password mentah tidak dikirim kembali dan tidak tersimpan di source frontend.
- Login profil dibatasi enam kegagalan per nomor selama 15 menit. Token sesi acak berlaku enam jam.
- Hash PIN memakai salt unik dan secret server pada Script Properties; PIN tidak pernah dikirim kembali ke browser atau spreadsheet.
- Endpoint catatan selalu mengambil ID profil dari token server, bukan dari ID yang dikirim browser, sehingga pengguna tidak dapat memilih profil milik orang lain.

## Tampilan dan SEO

Preferensi mode terang/gelap disimpan per perangkat. Seluruh halaman menggunakan favicon RATU, metadata deskripsi, judul unik, struktur heading semantik, dan `robots.txt` yang mengecualikan panel admin. Tambahkan canonical URL dan sitemap setelah domain produksi ditetapkan.

## Verifikasi integrasi

Endpoint `?action=health` memeriksa akses Apps Script ke tab `QuizResults` tanpa menambah baris. Endpoint leaderboard bersifat baca-saja. Sebelum acara, lakukan uji kirim satu peserta internal lalu hapus atau tandai baris tersebut `DISQUALIFIED`.
