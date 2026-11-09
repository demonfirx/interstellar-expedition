# Scene

Canvas WebGL memenuhi viewport. Texture dari referensi diproyeksikan dengan rasio yang dipertahankan dan crop adaptif. Shader memisahkan empat pita radial, mengalirkan masing-masing texture dengan kecepatan berbeda, dan memberikan distorsi lateral pada cakram tengah. Pusat event horizon tidak terkena rotasi texture.

Astronaut tetap berupa model voxel 3D dengan skeleton 16 tulang dan dua klip animasi. Warna suit, visor, dan pencahayaan menyesuaikan biru-ungu black hole. Tidak ada konten teks visual.

Suit dan visor memakai dua material terpisah dalam dua render group. Suit memantulkan lingkungan secara lembut; visor memakai lapisan clearcoat dan normal bersegi yang melengkung agar bentuk pixel tetap terbaca. Gambar referensi diprefilter sekali menjadi environment artistik, lalu dipakai sebagai pantulan. Plane kecil yang mengikuti tulang kepala menambahkan bentuk cincin dari gambar yang sama pada kaca visor. Cahaya biru-ungu dan cahaya cakram hangat berubah pelan dengan amplitudo kecil, mengikuti waktu scene. Jeda dan reduced motion juga membekukan perubahan pantulan. Environment ini merupakan interpretasi artistik dari gambar 2D, bukan tangkapan HDR 360°.

Kamera perspektif bergerak pelan menyamping dan mendekat/menjauh, dengan lintasan sinus kontinu berdurasi panjang. Mouse dihaluskan memakai damping berbasis waktu. Bintang jauh, bintang tengah, dan debu depan berada pada tiga rentang kedalaman sehingga pergeserannya mengikuti perspektif. Shader black hole mengikuti kamera dengan pergeseran dan pembesaran lebih kecil; overscan mencegah tepi texture masuk layar. Saat drag, input parallax tidak ikut berubah. Semua gerak kamera membeku bersama scene ketika jeda atau reduced motion aktif.

Kontrol hanya berupa tiga ikon kecil: jeda, suara, layar penuh. Interaksi klik dan seret tetap berfungsi pada canvas. Mode layar penuh bergantung pada dukungan browser; scene sudah memenuhi panel sejak awal.
