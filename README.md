# Interstellar

Beranda menampilkan arsip ekspedisi dengan tiga objek 3D. Klik atau tahan **Masuk arsip**, pilih objek dari daftar di bawah, lalu seret objek untuk memutarnya. Tombol panah mengganti pilihan. Saat area 3D menerima fokus, tombol panah memutar objek dan **Home** mengatur ulang sudut pandang.

Menu **Pelayaran** membuka pemandangan layar penuh dengan kapal layar low poly yang berlayar pelan menuju black hole. Ukuran cincin, cahaya, pantulan, angin, dan ombak berubah bersama jarak perjalanan. Kamera mengikuti dari belakang. Enam quote Inggris original bisa dimainkan saat berlayar.

## Menjalankan

```powershell
npm install
npm run dev
```

Preview: `http://127.0.0.1:5174/`.
Pelayaran: `http://127.0.0.1:5174/voyage.html`.

```powershell
npm test
npm run build
npm run preview
```

## Struktur

```text
src/
  archive/                      Galeri 3D, model instrumen, dan transisi partikel
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
  ui/quote-cycle.js              Waktu baca dan penundaan pergantian otomatis
  ui/quote-dust.js               Jejak debu bintang saat kata diseret
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

- Quote: seret kata lalu lepaskan; kata kembali halus. Ikon di bawah quote mengganti quote, menyebar kata, mengembalikan posisi, dan menjeda pergantian otomatis.
- Quote melayang pelan dengan pantulan biru-ungu serta kilau hangat. Pergantian otomatis setiap 16 detik memakai fade keluar/masuk. Saat hover, fokus keyboard, drag, atau kata masih bergerak, waktu baca dimulai ulang. Jeda scene membekukan gerak, cahaya, dan transisi; reduced motion menonaktifkan gerak dekoratif dan auto-ganti.
- Drag kata meninggalkan debu bintang kecil yang memudar dalam 2,1–2,8 detik. Setelah kata dilepas, debu membuat lengkungan orbit kecil lalu tertarik menuju posisi black hole di layar. Radius lengkungan hanya 6–10 px di desktop dan 4–7 px di ponsel; tarikan dibatasi 48 px. Efek tidak menambah partikel atau memperpanjang umurnya. Jumlah maksimum tetap 18 pada desktop dan 12 pada ponsel. Jeda membekukan partikel; reduced motion menonaktifkannya.
- Sebagian debu orbit memiliki jejak gradasi biru-ungu sepanjang maksimal 8 px desktop atau 6 px ponsel, dengan kilau lembut mengikuti fase cahaya black hole dan kedekatan kapal. Maksimal 3 jejak desktop dan 2 ponsel, dengan fade yang mengikuti debunya. Jumlah partikel tetap sama. Jejak tidak menangkap pointer dan ikut berhenti saat jeda.
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
