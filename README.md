# Interstellar

Pemandangan layar penuh dengan kapal layar low poly yang berlayar pelan menuju black hole. Ukuran cincin, cahaya, pantulan, angin, dan ombak berubah bersama jarak perjalanan. Kamera mengikuti dari belakang; jejak ombak tertinggal pada jalur dan kapal terpantul di air. Enam quote Inggris original menjadi satu-satunya tulisan visual, dengan kata yang bisa dimainkan.

## Menjalankan

```powershell
npm install
npm run dev
```

Preview: `http://127.0.0.1:5174/`.

```powershell
npm test
npm run build
npm run preview
```

## Struktur

```text
src/
  main.js                       Kontrol ikon dan shortcut
  models/sailing-vessel.js       Model kapal, kabin, layar, dan tali rigging
  models/sea-motion.js           Gelombang serta gerak mengapung kapal
  models/approach.js             Jarak, pembesaran cincin, cahaya, dan fase ombak
  scene/cosmos.js                Scene, pencahayaan, partikel, kamera
  scene/follow-camera.js        Kamera mengikuti kapal dari belakang
  scene/accretion-lighting.js    Pantulan lingkungan dan cahaya black hole
  scene/cosmic-ocean.js          Air, pantulan, dan riak di belakang kapal
  scene/ship-wake.js             Jejak ombak berdasarkan riwayat jalur kapal
  scene/vessel-reflection.js     Kamera cermin khusus kapal untuk pantulan air
  scene/shaders/black-hole.js    Animasi lapisan gambar referensi
  styles/main.css               Canvas penuh dan kontrol minimal
  ui/ambient.js                 Sintesis suara ambient
  ui/quotes.js                  Quote original, drag, sebar, dan kontrol keyboard
  ui/quote-physics.js            Pegas kata yang konsisten pada berbagai frame rate
public/
  assets/gargantua-reference.webp
  models/lumen-sailer.glb        Model kapal statis siap diimpor ke editor 3D
scripts/export-vessel.mjs        Ekspor ulang GLB kapal
tests/vessel.test.js             Validasi geometri dan kontak dengan gelombang
docs/
  archive/                      Versi landing awal, disimpan untuk nanti
  reference/                    Gambar original dari pengguna
  licenses/                     Lisensi dependensi
  rig.md                        Dokumentasi kontrol rig
  assets.md                     Asal aset
```

## Kontrol

- Quote: seret kata lalu lepaskan; kata kembali halus. Tiga ikon di bawah quote mengganti quote, menyebar kata, dan mengembalikan posisinya.
- Saat quote menerima fokus: **Enter/Spasi** menyebar kata, **Escape** merapikan, **Panah Kanan** mengganti quote. Shortcut ini tidak menggerakkan kamera.
- Seret: geser sudut kamera dalam batas sudut belakang kapal.
- Gerakkan mouse: parallax lembut dengan respons yang diredam. Kamera mengikuti perjalanan dari belakang agak menyamping, dengan posisi dan titik pandang yang dihaluskan terpisah; bintang jauh, lapisan tengah, dan debu depan menempati kedalaman berbeda.
- **M**: suara; **R**: reset sudut kamera; **Spasi**: jeda/lanjutkan.
- Ikon kecil kanan bawah: jeda, suara, dan layar penuh. Kontrol muncul saat pointer masuk atau menerima fokus keyboard.
- Preferensi reduced motion dihormati. Suara hanya mulai setelah interaksi.

Ekspor ulang kapal: `node scripts/export-vessel.mjs`. GLB menyimpan model statis; gelombang dan gerak layar dijalankan oleh kode scene.

Source dan GLB astronaut sebelumnya dipertahankan sebagai aset versi terdahulu; tidak dipakai pada scene aktif.

Shader menggerakkan piksel gambar sumber pada empat pita radial, bukan hanya menggeser seluruh gambar. Masker mempertahankan pusat gelap dan bentuk cakram tengah. Pengalaman artistik, bukan simulasi astrofisika.

Untuk QA lokal, `?sceneTime=600` memulai scene pada detik 600. Parameter ini hanya aktif pada mode development; build produksi selalu memulai perjalanan dari awal.
