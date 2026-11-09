# Interstellar

Pemandangan layar penuh tanpa tulisan. Gambar referensi black hole dianimasikan menjadi empat lapisan cahaya yang bergerak dengan kecepatan berbeda, disertai aliran cakram tengah, bintang, dan astronaut voxel biru-ungu yang melayang sambil dadah.

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
  models/astronaut.js            Model voxel, skeleton, klip animasi
  models/motion.js               Kurva melayang dan dadah dengan jeda alami
  scene/cosmos.js                Scene, pencahayaan, partikel, kamera
  scene/shaders/black-hole.js    Animasi lapisan gambar referensi
  styles/main.css               Canvas penuh dan kontrol minimal
  ui/ambient.js                 Sintesis suara ambient
public/
  assets/gargantua-reference.webp
  models/astro-rigged.glb        Model dengan rig 16 tulang dan 2 animasi
scripts/export-astronaut.mjs     Ekspor ulang GLB
tests/astronaut.test.js          Validasi rig, animasi, dan file GLB
docs/
  archive/                      Versi landing awal, disimpan untuk nanti
  reference/                    Gambar original dari pengguna
  licenses/                     Lisensi dependensi
  rig.md                        Dokumentasi kontrol rig
  assets.md                     Asal aset
```

## Kontrol

- Klik atau ketuk canvas: astronaut dadah.
- Seret: putar astronaut.
- **W**: dadah; **M**: suara; **R**: reset rotasi; **Spasi**: jeda/lanjutkan.
- Ikon kecil kanan bawah: jeda, suara, dan layar penuh. Kontrol muncul saat pointer masuk atau menerima fokus keyboard.
- Preferensi reduced motion dihormati. Suara hanya mulai setelah interaksi.

Ekspor ulang model: `node scripts/export-astronaut.mjs`.

Shader menggerakkan piksel gambar sumber pada empat pita radial, bukan hanya menggeser seluruh gambar. Masker mempertahankan pusat gelap dan bentuk cakram tengah. Pengalaman artistik, bukan simulasi astrofisika.
