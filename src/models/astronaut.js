import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Original rigid-weighted voxel model. Each block follows exactly one bone. */
export function createAstronaut() {
  const bones = {},
    list = [],
    pieces = [];
  function bone(name, parent, x, y, z) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) bones[parent].add(b);
    bones[name] = b;
    list.push(b);
    return b;
  }
  bone("root", null, 0, 0, 0);
  bone("spine_01", "root", 0, 0, 0);
  bone("neck", "spine_01", 0, 1, 0);
  bone("head", "neck", 0, 0.15, 0);
  for (const [s, sign] of [
    ["L", 1],
    ["R", -1],
  ]) {
    bone(`${s}_arm_upper`, "spine_01", sign * 0.87, 0.68, 0);
    bone(`${s}_arm_lower`, `${s}_arm_upper`, 0, -0.65, 0);
    bone(`${s}_hand`, `${s}_arm_lower`, 0, -0.59, 0);
    bone(`${s}_leg_upper`, "root", sign * 0.37, -0.77, 0);
    bone(`${s}_leg_lower`, `${s}_leg_upper`, 0, -0.72, 0);
    bone(`${s}_foot`, `${s}_leg_lower`, 0, -0.58, 0);
  }
  // Root-space boxes retain perfectly crisp voxel edges through the animation.
  function block(name, x, y, z, w, h, d, color) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    const n = g.attributes.position.count,
      c = new THREE.Color(color),
      colors = [],
      ids = [],
      weights = [];
    for (let i = 0; i < n; i++) {
      colors.push(c.r, c.g, c.b);
      ids.push(list.indexOf(bones[name]), 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(ids, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
    pieces.push(g);
  }
  const white = "#e8e9df",
    light = "#f8f6e9",
    shadow = "#a9b9c1",
    dark = "#344657",
    joint = "#5d6970",
    orange = "#ef8755";
  block("spine_01", 0, 0, 0, 1.27, 1.5, 0.83, white);
  block("spine_01", 0, 0.57, 0, 1.5, 0.38, 0.88, light);
  block("spine_01", 0, -0.62, 0.02, 1.34, 0.25, 0.94, shadow);
  block("spine_01", 0, -0.77, 0, 1.19, 0.2, 0.78, dark);
  // Life-support pack, visible from orbit and in the rotating crew preview.
  block("spine_01", 0, 0.15, -0.62, 1.09, 1.3, 0.49, shadow);
  block("spine_01", 0, 0.18, -0.9, 0.78, 0.97, 0.12, white);
  for (const x of [-0.38, 0.38])
    block("spine_01", x, 0.04, -0.93, 0.13, 0.76, 0.14, dark);
  block("spine_01", 0.42, 0.77, -0.61, 0.09, 0.75, 0.09, shadow);
  block("spine_01", 0.42, 1.17, -0.61, 0.12, 0.1, 0.12, orange);
  // Chest console, independent pixels, oxygen tubes and expedition patch.
  block("spine_01", 0, 0.14, 0.47, 0.77, 0.62, 0.16, shadow);
  block("spine_01", 0, 0.18, 0.57, 0.65, 0.44, 0.08, dark);
  block("spine_01", -0.12, 0.25, 0.62, 0.29, 0.15, 0.03, "#acd8c7");
  for (const [x, c] of [
    [-0.21, orange],
    [0, "#d7f59a"],
    [0.21, light],
  ])
    block("spine_01", x, 0.02, 0.63, 0.11, 0.09, 0.035, c);
  block("spine_01", -0.44, 0.58, 0.48, 0.23, 0.12, 0.04, orange);
  block("spine_01", 0.44, 0.57, 0.48, 0.18, 0.15, 0.04, "#738c9e");
  for (const x of [-0.5, 0.5]) {
    block("spine_01", x, -0.28, 0.48, 0.13, 0.37, 0.13, light);
    block("spine_01", x, -0.48, 0.41, 0.13, 0.13, 0.26, shadow);
  }
  // Stepped helmet silhouette: a cube-built cartoon helmet rather than a sphere.
  block("head", 0, 1.63, 0, 1.68, 1.35, 1.35, white);
  block("head", 0, 2.31, 0, 1.33, 0.2, 1.14, light);
  block("head", 0, 1.0, 0, 1.35, 0.16, 1.12, shadow);
  block("head", 0, 1.62, 0.7, 1.42, 1.04, 0.17, dark);
  block("head", 0, 1.63, 0.805, 1.22, 0.84, 0.1, "#a3692b");
  const visor = [
    ["#e4bf70", "#f9d58b", "#c99a4b", "#a9702a", "#9a5b22", "#875024"],
    ["#f3dca0", "#e7bd69", "#c58e35", "#ae7628", "#a66e26", "#8c5424"],
    ["#deb66a", "#c99442", "#bd8738", "#b58032", "#ac7129", "#a56827"],
    ["#a97636", "#b88841", "#b9883b", "#be8d40", "#b78339", "#98602a"],
  ];
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 6; x++)
      block(
        "head",
        (x - 2.5) * 0.2,
        1.94 - y * 0.2,
        0.869,
        0.202,
        0.202,
        0.04,
        visor[y][x],
      );
  block("head", -0.34, 1.99, 0.9, 0.33, 0.09, 0.02, "#fff1c9");
  block("head", -0.47, 1.83, 0.9, 0.09, 0.23, 0.02, "#f8e1a1");
  block("head", 0.4, 1.42, 0.9, 0.19, 0.09, 0.02, "#6b4828");
  for (const sign of [-1, 1]) {
    block("head", sign * 0.9, 1.6, 0, 0.16, 0.6, 0.65, shadow);
    block("head", sign * 0.99, 1.61, 0.08, 0.06, 0.32, 0.31, light);
    block("head", sign * 0.77, 1.12, 0.6, 0.12, 0.13, 0.12, orange);
  }
  for (const [s, sign] of [
    ["L", 1],
    ["R", -1],
  ]) {
    const x = sign * 0.94;
    block(`${s}_arm_upper`, x, 0.43, 0, 0.47, 0.65, 0.57, white);
    block(`${s}_arm_upper`, x, 0.69, 0.02, 0.55, 0.27, 0.65, light);
    block(`${s}_arm_upper`, x, 0.15, 0, 0.49, 0.13, 0.59, shadow);
    block(`${s}_arm_lower`, x, -0.15, 0, 0.44, 0.52, 0.51, white);
    block(`${s}_arm_lower`, x, -0.39, 0, 0.47, 0.15, 0.55, orange);
    block(`${s}_hand`, x, -0.63, 0.03, 0.43, 0.32, 0.49, light);
    block(`${s}_hand`, x + sign * 0.25, -0.59, 0.12, 0.13, 0.22, 0.22, shadow);
    for (let i = 0; i < 3; i++)
      block(
        `${s}_hand`,
        x + (i - 1) * 0.13,
        -0.82,
        0.06,
        0.11,
        0.13,
        0.34,
        white,
      );
    const lx = sign * 0.37;
    block(`${s}_leg_upper`, lx, -1.08, 0, 0.55, 0.62, 0.66, white);
    block(`${s}_leg_upper`, lx, -1.38, 0.03, 0.56, 0.14, 0.67, shadow);
    block(`${s}_leg_lower`, lx, -1.68, 0, 0.5, 0.5, 0.58, white);
    block(`${s}_leg_lower`, lx, -1.8, 0.31, 0.32, 0.23, 0.07, shadow);
    block(`${s}_foot`, lx, -2.02, 0.13, 0.6, 0.34, 0.85, white);
    block(`${s}_foot`, lx, -2.2, 0.17, 0.62, 0.12, 0.92, dark);
    block(`${s}_foot`, lx, -2.03, 0.58, 0.43, 0.17, 0.09, shadow);
  }
  const geometry = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.63,
    metalness: 0.12,
    flatShading: true,
  });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "ASTRO_01";
  mesh.add(bones.root);
  mesh.bind(new THREE.Skeleton(list));
  mesh.frustumCulled = false;
  mesh.userData = {
    artist: "Original procedural voxel model",
    rig: "16-bone rigid weighted FK",
    units: "meters",
    controls: "L_arm_upper/L_arm_lower/L_hand: wave. root: float.",
  };
  return { mesh, bones };
}

function quaternionTrack(name, duration, pose) {
  const times = [],
    values = [];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96,
      e = pose(t === 1 ? 0 : t);
    times.push(t * duration);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...e));
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

export function createAnimationClips() {
  const tau = Math.PI * 2;
  const floating = new THREE.AnimationClip("AN_Astro_Float", 8, [
    quaternionTrack("R_arm_upper", 8, (t) => [
      0.1 + 0.1 * Math.sin(t * tau),
      0,
      -0.28 + 0.09 * Math.cos(t * tau),
    ]),
    quaternionTrack("R_arm_lower", 8, (t) => [
      -0.2 + 0.1 * Math.sin(t * tau),
      0,
      -0.16,
    ]),
    quaternionTrack("L_leg_upper", 8, (t) => [
      -0.19 + 0.1 * Math.sin(t * tau),
      0,
      0.14,
    ]),
    quaternionTrack("L_leg_lower", 8, (t) => [
      0.29 + 0.15 * Math.sin(t * tau),
      0,
      0,
    ]),
    quaternionTrack("R_leg_upper", 8, (t) => [
      0.1 + 0.1 * Math.sin(t * tau + 0.8),
      0,
      -0.18,
    ]),
    quaternionTrack("R_leg_lower", 8, (t) => [
      0.15 + 0.07 * Math.cos(t * tau),
      0,
      0,
    ]),
  ]);
  const waving = new THREE.AnimationClip("AN_Astro_Wave", 4, [
    quaternionTrack("L_arm_upper", 4, (t) => [
      0.04,
      0,
      2.15 + 0.08 * Math.sin(t * tau),
    ]),
    quaternionTrack("L_arm_lower", 4, (t) => [
      0,
      0,
      0.48 + 0.38 * Math.sin(t * tau * 3),
    ]),
    quaternionTrack("L_hand", 4, (t) => [
      0.1 * Math.sin(t * tau * 3),
      0,
      0.12 * Math.sin(t * tau * 3 + 0.3),
    ]),
    quaternionTrack("head", 4, (t) => [
      0.02,
      0.08 * Math.sin(t * tau),
      -0.06 + 0.04 * Math.sin(t * tau),
    ]),
  ]);
  return [floating, waving];
}
