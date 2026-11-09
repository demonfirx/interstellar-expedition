# Interstellar

Website ruang angkasa interaktif dengan astronaut voxel 3D original. Model memiliki rig 16 tulang, animasi melayang, dan gerakan dadah. Menggunakan Vite, Three.js, dan ikon Lucide.

## Menjalankan

```powershell
npm install
npm run dev
```

Buka alamat yang dicetak terminal. Port default: **5174**.

```powershell
npm test
npm run build
npm run preview
```

## Struktur

```text
src/
  main.js                 Interaksi, navigasi, dan state halaman
  models/astronaut.js      Model voxel, skeleton, dan klip animasi
  scene/cosmos.js          Renderer, pencahayaan, shader, dan kamera
  styles/main.css         Token visual dan layout responsif
  ui/ambient.js            Suara ambient dari Web Audio
public/
  assets/                  Referensi visual dan font lokal
  models/astro-rigged.glb   Model siap diimpor ke Blender atau engine 3D
scripts/
  export-astronaut.mjs     Ekspor ulang model beserta rig dan animasi
tests/
  astronaut.test.js        Validasi skeleton, bobot, dan loop animasi
docs/                      Desain, kontrol rig, dan asal aset
index.html                 Struktur konten halaman
```

## Kontrol

- Seret astronaut untuk memutar kamera orbit.
- **W**: dadah. **M**: suara ambient. **R**: reset kamera. **Esc**: keluar tampilan imersif.
- Tombol jeda menghentikan gerak scene. Preferensi reduced motion perangkat dihormati.
- Pilih destinasi lalu tekan **Set course** untuk mengganti pemandangan.
- **Get the 3D model** mengunduh GLB dengan rig dan kedua animasinya.

Ekspor ulang setelah mengubah model: `node scripts/export-astronaut.mjs`.

Pengalaman ini menggunakan latar fiksi terinspirasi Interstellar. Pemandangan dan nilai koordinat bersifat ilustratif.
