# RATU Finansial

Website mobile-first untuk materi finansial, kuis 10 soal, dan leaderboard 50 peserta. Seluruh aset visual berada di dalam folder `assets`, sehingga tidak lagi bergantung pada lokasi file di luar proyek.

## Panel admin

Panel tersedia pada `admin.html` dan mengendalikan periode, jadwal buka/tutup, jumlah soal, isi pilihan jawaban, serta kunci jawaban. Panel juga menampilkan seluruh peserta dan leaderboard lintas periode.

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

Urutan leaderboard: nilai tertinggi, durasi tercepat, kemudian timestamp paling awal. Hanya baris berstatus `VALID` yang ditampilkan; entri terlalu cepat masuk status `REVIEW` untuk pemeriksaan panitia.

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
- Maksimal leaderboard publik adalah 50 peserta.
- Panitia dapat mengubah status menjadi `DISQUALIFIED`; hanya status `VALID` yang muncul ke publik.
- Endpoint admin memerlukan token sesi server; password mentah tidak dikirim kembali dan tidak tersimpan di source frontend.

## Tampilan dan SEO

Preferensi mode terang/gelap disimpan per perangkat. Seluruh halaman menggunakan favicon RATU, metadata deskripsi, judul unik, struktur heading semantik, dan `robots.txt` yang mengecualikan panel admin. Tambahkan canonical URL dan sitemap setelah domain produksi ditetapkan.

## Verifikasi integrasi

Endpoint `?action=health` memeriksa akses Apps Script ke tab `QuizResults` tanpa menambah baris. Endpoint leaderboard bersifat baca-saja. Sebelum acara, lakukan uji kirim satu peserta internal lalu hapus atau tandai baris tersebut `DISQUALIFIED`.
