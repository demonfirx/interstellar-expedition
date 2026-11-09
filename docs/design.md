# Scene

Canvas WebGL memenuhi viewport. Texture dari referensi diproyeksikan dengan rasio yang dipertahankan dan crop adaptif. Shader memisahkan empat pita radial, mengalirkan masing-masing texture dengan kecepatan berbeda, dan memberikan distorsi lateral pada cakram tengah. Pusat event horizon tidak terkena rotasi texture.

Scene aktif memakai kapal layar low poly original. Lambung, dek, kabin, tiang, dan tali rigging digabung per material agar draw call tetap kecil. Dua layar memiliki geometri kain yang bergerak pelan. Tinggi, pitch, dan roll kapal dihitung dari fungsi gelombang yang sama dengan air agar kapal tetap menempel di permukaan.

Gambar referensi diprefilter sekali menjadi environment artistik untuk lambung, perlengkapan, dan kaca kabin. Pantulan cincin pada kaca memakai glow kecil. Shader latar menambahkan halo lokal berintensitas rendah dengan batas luminance agar inti cincin tidak makin terang. Laut memakai pantulan gambar, riak tidak beraturan, bayangan kontak, dan wake tipis di belakang kapal. Semua gerak mengikuti satu waktu scene dan berhenti saat jeda atau reduced motion aktif. Environment ini merupakan interpretasi artistik gambar 2D, bukan tangkapan HDR 360°.

Kamera perspektif bergerak pelan menyamping dan mendekat/menjauh, dengan lintasan sinus kontinu berdurasi panjang. Mouse dihaluskan memakai damping berbasis waktu. Bintang jauh, bintang tengah, dan debu depan berada pada tiga rentang kedalaman sehingga pergeserannya mengikuti perspektif. Shader black hole mengikuti kamera dengan pergeseran dan pembesaran lebih kecil; overscan mencegah tepi texture masuk layar. Saat drag, input parallax tidak ikut berubah. Semua gerak kamera membeku bersama scene ketika jeda atau reduced motion aktif.

Kontrol hanya berupa tiga ikon kecil: jeda, suara, layar penuh. Interaksi klik dan seret tetap berfungsi pada canvas. Mode layar penuh bergantung pada dukungan browser; scene sudah memenuhi panel sejak awal.
