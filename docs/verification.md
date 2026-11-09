# Verification

- Sepuluh tes Node lulus: validitas geometri dan normal kapal, keberadaan dua layar dan material kaca, kontak dengan gelombang, batas kecepatan gerak, kamera perspektif dan urutan parallax, serta regresi aset astronaut versi terdahulu.
- Scene kapal diperiksa pada desktop dan 390 × 844. Canvas dan buffer sesuai viewport, tidak ada overflow, dan `document.body.innerText` kosong.
- Shader laut, halo cincin, dan pantulan kabin berhasil dikompilasi. Tidak ada error atau warning console pada preview terakhir.
- Jeda dan lanjutkan terverifikasi melalui state kontrol. Semua gerak memakai waktu scene yang sama, termasuk kamera, gelombang, kapal, layar, dan pantulan.
- Model kapal diekspor sebagai GLB statis sekitar 169 KB tanpa peringatan normal geometri. Gerakan layar dan gelombang ditangani runtime.
- Build produksi berhasil. Engine Three.js memunculkan peringatan ukuran bundle di atas 500 KB uncompressed; bukan kegagalan build.
- Glow lokal memiliki gain kecil dan pengurang berdasarkan luminance untuk menjaga inti cincin tetap terbaca. Pusat event horizon tidak diberi glow.

Fullscreen native bergantung pada browser dan bisa tidak tersedia di panel embedded. Reduced motion mengikuti preferensi perangkat; emulasi preferensi otomatis tidak tersedia pada kontrol browser yang digunakan. Scene ini merupakan interpretasi artistik, bukan simulasi astrofisika.
