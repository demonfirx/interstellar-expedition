# Verification

- Tujuh tes Node: hierarki dan bobot skeleton; loop kedua animasi; file GLB dimuat kembali dengan 16 tulang serta dua klip yang utuh; fase dadah dan jeda; batas kecepatan lintasan; kontinuitas kamera; urutan pergeseran parallax melalui proyeksi kamera perspektif.
- Scene terbaru diperiksa pada viewport desktop dan 390 × 844. Canvas memenuhi layar; tidak ada tulisan terlihat (`document.body.innerText` kosong).
- Shader berhasil dikompilasi tanpa error console pada preview terbaru. Empat pita texture dan aliran cakram bergerak; pusat gelap dipertahankan.
- Tombol jeda dan lanjutkan terverifikasi melalui state kontrol. Model tetap melayang dan dadah dengan palet biru-ungu.
- Revisi gerak: aliran lapisan dipercepat sekitar 2,3× dengan adveksi bergantian yang dibatasi agar bentuk halo terjaga. Kurva melayang memakai lintasan gabungan yang kontinu; gerak pergelangan dan lutut mengikuti gerak utama dengan jeda fase.
- Build produksi dijalankan kembali setelah revisi scene. Ukuran engine Three.js memunculkan peringatan bundle di atas 500 KB uncompressed.
- Revisi kedalaman: kamera perspektif dengan drift dan dolly pelan, damping mouse berbasis waktu, tiga lapisan bintang, serta overscan background. Canvas dan buffer rendering diperiksa pada desktop dan 390 × 844; tidak ada teks atau overflow.

Fullscreen native bergantung pada browser dan bisa tidak tersedia di panel embedded. Reduced motion mengikuti preferensi perangkat; emulasi preferensi otomatis tidak tersedia pada kontrol browser yang digunakan.
