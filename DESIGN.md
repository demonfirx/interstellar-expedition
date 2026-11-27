# Visual system

## Arsip ekspedisi

Model 3D menjadi fokus di panggung gelap kosmik dengan pencahayaan studio observatorium khusus dan harmoni aksen per objek (tembaga untuk Tidal Array, biru langit bulan untuk Lumen Sailer, emas akresi untuk Event Horizon). Tidak ada placeholder CSS statis sebelum WebGL; canvas 3D diinisialisasi langsung dengan fallback aman untuk post-processing. Tipografi self-hosted memadukan Bodoni Moda untuk judul display, Manrope untuk antarmuka dan teks baca, serta JetBrains Mono khusus untuk indeks katalog dan telemetri sudut orbit real-time (`AZ / EL / ZM`). Mode ikhtisar menampilkan komposisi asimetris dan beralih mulus ke mode inspeksi layar penuh saat masuk arsip atau menyeret objek 3D, dilengkapi lembaran monograf sisi kanan (bottom sheet di ponsel) yang dapat diakses penuh lewat keyboard.

## Halaman Maerith (`maerith.html`)

Halaman mandiri dengan identitas Crumbling Farum Azula: basal gelap (`#090708`), emas kuno (`#cfa65d`) untuk Fase I, dan merah Destined Death (`#e03c49`) untuk Fase II. Tipografi self-hosted memadukan Cinzel, Manrope, dan JetBrains Mono. Panggung WebGL merender model 3D Maerith asli (`tpose.fbx`, `textures.glb`, `sword.glb`) di atas dais batu melingkar dengan orbit 360°, zoom, pergantian Fase I/II, pilihan pose animasi skeletal, lembaran arsip serangan, serta tautan langsung ke arena duel dan eksplorasi di `elden.html`.

## Mode pelayaran

Satu scene penuh dengan quote Inggris original sebagai satu-satunya teks terlihat. Gambar black hole menjadi latar lautan kosmik, dengan kapal layar kecil di bagian bawah pemandangan.

- Palet: hitam kebiruan, cahaya biru-ungu, sedikit pantulan hangat dari cakram sumber.
- Kapal: lambung biru gelap, dek kayu redup, dua layar keperakan, kabin dengan pantulan kaca, dan lampu kecil yang lembut.
- Pantulan: kaca kabin dan air menerima cahaya biru-ungu serta sedikit kilau hangat. Glow beramplitudo rendah; inti cincin terang tidak diperkuat.
- Empat lapisan radial dari gambar sumber bergerak independen. Cakram tengah memiliki aliran lateral; pusat gelap dipertahankan.
- Framing: sudut belakang agak menyamping, kapal di bagian bawah frame, dengan ruang untuk tiang, jejak ombak, dan black hole di depan.
- Perjalanan: kapal melaju perlahan ke black hole dan kamera menjaga jaraknya sambil mengikuti. Jejak ombak tertinggal di lintasan dan pantulan cermin di air dilembutkan oleh riak.
- Kedekatan: zoom cincin berpusat pada event horizon, bertambah tanpa reset hingga maksimum 1,55× portrait dan 1,85× desktop lebar. Cahaya dan ombak meningkat dalam batas kecil, dengan fase gerak kontinu. Pusat gelap dipertahankan.
- Kedalaman: kamera perspektif mengikuti dari belakang dengan pergantian sudut perlahan, parallax mouse yang diredam, air 3D, dan tiga lapisan partikel.
- Quote: Manrope, kiri atas, tanpa kartu. Grup kata melayang dengan amplitudo 3 px horizontal, 6 px vertikal, dan rotasi maksimum 0,25 derajat. Pantulan gradasi biru-ungu dan putih hangat bergerak pelan, dengan glow kecil yang meningkat sesuai kedekatan kapal. Kata dapat diseret lalu kembali dengan pegas teredam. Pergantian otomatis 16 detik memakai fade keluar 350 ms dan masuk 700 ms. Ikon untuk next, scatter, reset, dan jeda auto. Tidak ada heading, navbar, footer, toast, atau label kontrol visual.
- Aria labels, fokus keyboard, pause, reduced motion, fallback gambar, dan audio opt-in tersedia.
- Debu quote: titik kecil 1,2–2,4 px dengan glow redup, dominan biru-ungu dan sedikit hangat. Setelah dilepas, debu membuat lengkungan orbit kecil sebelum tertarik ke pusat black hole. Radius orbit 6–10 px desktop dan 4–7 px ponsel, mengecil sebelum tarikan mengambil alih. Jarak tarik maksimum 48 px dan umur tetap 2,1–2,8 detik. Tidak ada ledakan partikel, dan tidak muncul saat kata diam.
- Jejak orbit: garis 0,6 px desktop atau 0,5 px ponsel, sepanjang maksimal 8/6 px. Hanya sebagian titik memakai jejak, maksimal 3/2 sekaligus. Gradasi biru-ungu memiliki kilau biru pucat dan halo 1,2 px yang sangat redup. Warna serta gain halo mengikuti fase cahaya quote dan kedekatan kapal, dengan perubahan kecil. Opacity tetap rendah, memudar bersama tarikan, dan berada di bawah quote.

Versi landing sebelumnya disimpan di `docs/archive/` dan tidak masuk build.
