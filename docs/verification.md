# Verification

- Tiga tes Node: hierarki dan bobot skeleton; loop kedua animasi; file GLB dimuat kembali dengan 16 tulang serta dua klip yang utuh.
- Scene terbaru diperiksa pada viewport desktop dan 390 × 844. Canvas memenuhi layar; tidak ada tulisan terlihat (`document.body.innerText` kosong).
- Shader berhasil dikompilasi tanpa error console pada preview terbaru. Empat pita texture dan aliran cakram bergerak; pusat gelap dipertahankan.
- Tombol jeda dan lanjutkan terverifikasi melalui state kontrol. Model tetap melayang dan dadah dengan palet biru-ungu.
- Build produksi dijalankan kembali setelah revisi scene. Ukuran engine Three.js memunculkan peringatan bundle di atas 500 KB uncompressed.

Fullscreen native bergantung pada browser dan bisa tidak tersedia di panel embedded. Reduced motion mengikuti preferensi perangkat; emulasi preferensi otomatis tidak tersedia pada kontrol browser yang digunakan.
