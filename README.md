# Interstellar

Pemandangan layar penuh tanpa tulisan. Kapal layar low poly menjelajahi lautan kosmik di bawah black hole berlapis. Cincin memiliki glow tipis, air memantulkan cahaya, layar bergerak lembut, dan lambung mengikuti gelombang.

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
  scene/cosmos.js                Scene, pencahayaan, partikel, kamera
  scene/camera-motion.js         Lintasan kamera dan kedalaman parallax
  scene/accretion-lighting.js    Pantulan lingkungan dan cahaya black hole
  scene/cosmic-ocean.js          Air, pantulan, dan riak di belakang kapal
  scene/shaders/black-hole.js    Animasi lapisan gambar referensi
  styles/main.css               Canvas penuh dan kontrol minimal
  ui/ambient.js                 Sintesis suara ambient
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

- Seret: putar kapal.
- Gerakkan mouse: parallax lembut dengan respons yang diredam. Kamera juga bergerak pelan saat tidak ada input; bintang jauh, lapisan tengah, dan debu depan menempati kedalaman berbeda.
- **M**: suara; **R**: reset rotasi; **Spasi**: jeda/lanjutkan.
- Ikon kecil kanan bawah: jeda, suara, dan layar penuh. Kontrol muncul saat pointer masuk atau menerima fokus keyboard.
- Preferensi reduced motion dihormati. Suara hanya mulai setelah interaksi.

Ekspor ulang kapal: `node scripts/export-vessel.mjs`. GLB menyimpan model statis; gelombang dan gerak layar dijalankan oleh kode scene.

Source dan GLB astronaut sebelumnya dipertahankan sebagai aset versi terdahulu; tidak dipakai pada scene aktif.

Shader menggerakkan piksel gambar sumber pada empat pita radial, bukan hanya menggeser seluruh gambar. Masker mempertahankan pusat gelap dan bentuk cakram tengah. Pengalaman artistik, bukan simulasi astrofisika.
