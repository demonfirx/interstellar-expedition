# Rig ASTRO_01

Model dibuat secara prosedural dari balok voxel. Ini merupakan mesh 3D dengan skeleton, bukan sprite atau video. Semua vertex memiliki satu pengaruh tulang berbobot 1.0 agar bentuk voxel tetap tegas saat sendi berputar.

Skeleton FK 16 tulang: root, spine_01, neck, head; lengan kiri dan kanan (arm_upper, arm_lower, hand); kaki kiri dan kanan (leg_upper, leg_lower, foot). Root tunggal menjadi induk; kepala mengikuti leher, tangan mengikuti siku, dan telapak mengikuti lutut.

Klip `AN_Astro_Float` berdurasi 8 detik. Klip `AN_Astro_Wave` berdurasi 4 detik. Kedua klip berulang tanpa sambungan pose yang terputus dan tanpa keyframe scale. Gerakan root melayang di scene bersifat in-place; posisi root dunia tidak dibakar ke klip GLB.

Kontrol utama dadah: L_arm_upper, L_arm_lower, L_hand. Tidak memerlukan IK karena tidak ada kontak tanah atau objek yang harus dipertahankan. Weight rigid dipilih untuk gaya voxel dan tidak untuk deformasi karakter organik.

Impor `public/models/astro-rigged.glb` ke Blender untuk memeriksa mesh, skeleton, dan action. File Blender tidak dibutuhkan oleh runtime website.
