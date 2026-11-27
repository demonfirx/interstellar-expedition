import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { createDestinedDeathShaderMaterial } from "./materials.js";

const MODEL_BASE = "/models/elden";
const PACK_URL = `${MODEL_BASE}/elden-pack.glb`;

function loadPackedEldenAssets(onProgress, startLabel, doneLabel) {
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  onProgress(0.08, startLabel);

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      PACK_URL,
      (gltf) => {
        const byName = new Map();
        for (const s of gltf.scenes ?? []) {
          if (s?.name) byName.set(s.name, s);
        }
        onProgress(0.85, doneLabel);
        resolve({
          warrior: byName.get("warrior") ?? gltf.scene,
          palette: byName.get("palette"),
          sword: byName.get("sword"),
          scabbard: byName.get("scabbard"),
          animations: gltf.animations ?? [],
        });
      },
      (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
          onProgress(0.08 + (xhr.loaded / xhr.total) * 0.72, startLabel);
        }
      },
      reject
    );
  });
}

const VARIANT_SUFFIX = /(\.\d{3}|\s*\(\d+\))$/;
const MATERIAL_WORD = /^(?:material|mat)|(?:material|mat)$/g;

function normalizeName(name) {
  return String(name ?? "")
    .replace(VARIANT_SUFFIX, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function keysFor(name) {
  const exact = normalizeName(name);
  if (!exact) return [];
  const bare = exact.replace(MATERIAL_WORD, "");
  return bare && bare !== exact ? [exact, bare] : [exact];
}

function flipTextureV(texture) {
  texture.repeat.y = -1;
  texture.offset.y = 1;
}

function buildMaterialPalette(gltfScene, flipV = true) {
  const byName = new Map();
  const byMesh = new Map();
  const materials = [];
  const meshClaims = [];

  gltfScene.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of list) {
      if (!mat) continue;
      if (!materials.includes(mat)) {
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        for (const key of Object.keys(mat)) {
          const val = mat[key];
          if (val && val.isTexture) {
            val.anisotropy = 4;
            if (flipV) flipTextureV(val);
          }
        }
        materials.push(mat);
      }
      for (const k of keysFor(mat.name)) {
        if (!byName.has(k)) byName.set(k, mat);
      }
      if (list.length === 1) meshClaims.push([node.name, mat]);
    }
  });

  for (const [meshName, mat] of meshClaims) {
    for (const k of keysFor(meshName)) {
      if (byName.has(k)) continue;
      const held = byMesh.get(k);
      if (held === undefined) byMesh.set(k, mat);
      else if (held !== mat) byMesh.set(k, null);
    }
  }

  gltfScene.traverse((node) => node.geometry?.dispose());
  gltfScene.clear();

  return {
    materials,
    resolve(matName, meshName) {
      const keys = [...keysFor(matName), ...keysFor(meshName)];
      for (const k of keys) if (byName.has(k)) return byName.get(k);
      for (const k of keys) if (byMesh.get(k)) return byMesh.get(k);
      return materials.length === 1 ? materials[0] : null;
    },
  };
}

function indexBones(root) {
  const map = new Map();
  root.traverse((node) => {
    if (!node.isBone) return;
    map.set(node.name, node);
    const short = node.name.split(":").pop().replace(/^mixamorig/i, "");
    if (short && !map.has(short)) map.set(short, node);
  });
  return map;
}

function measureRigForwardYaw(bones) {
  const foot = bones.get("LeftFoot");
  const toe = bones.get("LeftToeBase");
  if (!foot || !toe) return 0;
  const heel = foot.getWorldPosition(new THREE.Vector3());
  const tip = toe.getWorldPosition(new THREE.Vector3()).sub(heel).setY(0);
  if (tip.lengthSq() < 1e-6) return 0;
  tip.normalize();
  return Math.atan2(tip.x, tip.z);
}

function attachToBone(bone, child, { position = [0, 0, 0], rotationDeg = [0, 0, 0], scale = 1 }, rigFactor = 1) {
  if (!bone) return null;
  const mount = new THREE.Group();
  bone.add(mount);
  bone.updateWorldMatrix(true, false);

  const worldScale = new THREE.Vector3();
  bone.getWorldScale(worldScale);
  const inv = Math.abs(worldScale.x) > 1e-9 ? rigFactor / worldScale.x : rigFactor;
  mount.scale.setScalar(inv);

  child.position.set(position[0], position[1], position[2]);
  child.rotation.set(
    THREE.MathUtils.degToRad(rotationDeg[0]),
    THREE.MathUtils.degToRad(rotationDeg[1]),
    THREE.MathUtils.degToRad(rotationDeg[2])
  );
  child.scale.setScalar(scale);
  mount.add(child);
  return mount;
}

/**
 * Organic wispy GLSL flame sheath wrapping cleanly around a 3D sword along +Z.
 * ZERO BoxGeometry edges: uses layered crossed curved flame planes with FBM turbulence,
 * radial smoothstep tapering, and undulating vertex tips.
 */
function createOrganicBladeAura({
  length = 1.12,
  width = 0.28,
  zStart = 0.14,
  outerColor = new THREE.Color(2.6, 0.95, 0.22),
  coreColor = new THREE.Color(4.2, 2.8, 1.35),
  darkCore = false,
}) {
  const group = new THREE.Group();

  // Build organic tapered flame ribbon running from zStart to zStart + length
  const createFlameRibbon = (rotZ, phaseOffset, wScale) => {
    const geo = new THREE.PlaneGeometry(width * wScale, length, 6, 26);
    // Align plane so UV.y = 0 at hilt (zStart) and UV.y = 1 at blade tip (zStart + length)
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, zStart + length * 0.5);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: darkCore ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
        uPhase: { value: phaseOffset },
        uOuter: { value: outerColor },
        uCore: { value: coreColor },
        uDarkCore: { value: darkCore ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uPhase;
        uniform float uIntensity;
        void main() {
          vUv = uv;
          vec3 p = position;
          // Taper ribbon smoothly toward hilt and blade tip + organic fire flicker wave
          float env = sin(uv.y * 3.14159) * (1.0 - uv.y * 0.35);
          float sway = sin(uv.y * 12.0 - uTime * 11.5 + uPhase) * 0.032 * env * uIntensity;
          float lift = cos(uv.y * 8.5 - uTime * 9.0 + uPhase * 1.7) * 0.024 * env * uIntensity;
          p.x += sway;
          p.y += lift;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPhase;
        uniform vec3 uOuter;
        uniform vec3 uCore;
        uniform float uDarkCore;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.52;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.08;
            a *= 0.48;
          }
          return v;
        }

        void main() {
          // Cross-section distance from blade centerline (0 = blade center, 1 = outer edge)
          float xDist = abs(vUv.x - 0.5) * 2.0;
          float y = vUv.y;

          // Organic upward-flowing flame turbulence
          vec2 flow = vec2(vUv.x * 3.4 + uPhase, y * 5.2 - uTime * 4.4);
          float turb = fbm(flow + vec2(fbm(flow * 1.6 + uTime * 1.2) * 0.8, 0.0));

          // Smooth organic envelope: zero hard rectangular edges!
          float taper = smoothstep(0.0, 0.14, y) * (1.0 - smoothstep(0.68, 1.0, y));
          float flameWidth = (0.34 + 0.58 * turb) * (1.0 - y * 0.42);
          float radial = 1.0 - smoothstep(0.0, max(0.05, flameWidth), xDist);
          float wisp = pow(max(0.0, radial), 1.45) * taper * smoothstep(0.22, 0.78, turb + (1.0 - xDist) * 0.45);

          if (wisp < 0.015) discard;

          float innerHeat = pow(max(0.0, 1.0 - xDist * 1.9), 2.2) * taper;
          vec3 col = mix(uOuter, uCore, clamp(innerHeat * 0.85 + turb * 0.35, 0.0, 1.0));
          float alpha = clamp(wisp * 0.88 * uIntensity, 0.0, 0.94);

          if (uDarkCore > 0.5) {
            // Destined Death black-flame outer smoke licking around crimson-gold plasma core
            vec3 blackSmoke = vec3(0.04, 0.005, 0.012);
            float crimsonBand = smoothstep(0.18, 0.62, wisp * 0.95 + innerHeat * 0.6);
            float hotBand = smoothstep(0.65, 0.96, innerHeat * 0.95 + turb * 0.35);
            col = mix(blackSmoke, uOuter, crimsonBand);
            col = mix(col, uCore, hotBand);
            alpha = clamp(wisp * 0.92 * min(1.35, uIntensity), 0.0, 0.92);
          }

          gl_FragColor = vec4(col * uIntensity, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = rotZ;
    mesh.renderOrder = 6;
    group.add(mesh);
    return mat;
  };

  // 3 intersecting angled organic flame curtains (360° volumetric look from every camera angle!)
  const mats = [
    createFlameRibbon(0, 0.0, 1.0),
    createFlameRibbon(Math.PI / 3, 2.1, 0.92),
    createFlameRibbon((Math.PI * 2) / 3, 4.3, 0.92),
  ];

  return {
    group,
    update(time, intensity = 1.0) {
      for (const m of mats) {
        m.uniforms.uTime.value = time;
        m.uniforms.uIntensity.value = intensity;
      }
    },
  };
}

/**
 * Curved metallic domed buckler shield (SphereGeometry + Torus rim — ZERO BoxGeometry!)
 * with a golden magical parry/guard ward ring that glows when blocking.
 */
function createCurvedBucklerShield() {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x3b4049,
    roughness: 0.3,
    metalness: 0.9,
    envMapIntensity: 1.2,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a152,
    roughness: 0.24,
    metalness: 0.95,
    envMapIntensity: 1.3,
  });

  // Gently domed forged steel buckler shell
  const domeGeo = new THREE.SphereGeometry(0.46, 24, 14, 0, Math.PI * 2, 0, 0.56);
  domeGeo.rotateX(Math.PI / 2);
  domeGeo.translate(0, 0, -0.38);
  const dome = new THREE.Mesh(domeGeo, steelMat);
  dome.castShadow = true;
  group.add(dome);

  // Embossed gilded outer rim & inner concentric ring
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.018, 10, 28), goldMat);
  outerRim.position.set(0, 0, 0.01);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), goldMat);
  boss.scale.set(1, 1, 0.52);
  boss.position.set(0, 0, 0.075);
  group.add(outerRim, boss);

  // Ethereal golden guard ward halo (lights up cleanly when holding SHIFT to block!)
  const wardMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uActive;
      void main() {
        if (uActive < 0.02) discard;
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float ring = exp(-pow((r - 0.82) * 14.0, 2.0));
        float rune = 0.5 + 0.5 * sin(a * 12.0 + uTime * 3.5);
        float fill = smoothstep(0.95, 0.25, r) * 0.22;
        vec3 col = vec3(2.8, 1.9, 0.72) * (ring * (0.7 + 0.5 * rune) + fill);
        float alpha = (ring * 0.9 + fill) * uActive;
        if (r > 1.0) discard;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const wardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), wardMat);
  wardMesh.position.set(0, 0, 0.11);
  wardMesh.renderOrder = 7;
  group.add(wardMesh);

  return { group, wardMat };
}

/**
 * Curved gilded beast-knight crown, sweeping horns (TubeGeometry), and glowing crimson eyes
 * mounted onto Maerith's Head bone.
 */
function createMaerithCrownAndHorns() {
  const group = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc99c46,
    roughness: 0.24,
    metalness: 0.95,
    envMapIntensity: 1.3,
  });
  const obsidianMat = new THREE.MeshStandardMaterial({
    color: 0x161218,
    roughness: 0.28,
    metalness: 0.92,
    envMapIntensity: 1.2,
  });
  const eyeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(4.2, 0.22, 0.32),
  });

  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.09, 0.14, 0.02),
      new THREE.Vector3(side * 0.24, 0.26, -0.04),
      new THREE.Vector3(side * 0.34, 0.44, -0.14),
      new THREE.Vector3(side * 0.27, 0.62, -0.08),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.028, 8, false);
    const pos = tubeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const ringIdx = Math.floor(i / 9);
      const t = ringIdx / 20;
      const center = curve.getPoint(Math.min(1, t));
      const scale = Math.max(0.08, 1 - t * 0.92);
      pos.setXYZ(
        i,
        center.x + (pos.getX(i) - center.x) * scale,
        center.y + (pos.getY(i) - center.y) * scale,
        center.z + (pos.getZ(i) - center.z) * scale
      );
    }
    tubeGeo.computeVertexNormals();
    const horn = new THREE.Mesh(tubeGeo, goldMat);
    horn.castShadow = true;
    group.add(horn);

    const subCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.11, 0.08, 0.01),
      new THREE.Vector3(side * 0.21, 0.12, -0.08),
      new THREE.Vector3(side * 0.25, 0.22, -0.18),
    ]);
    const subHorn = new THREE.Mesh(new THREE.TubeGeometry(subCurve, 10, 0.015, 6, false), obsidianMat);
    group.add(subHorn);
  }

  const browBand = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.015, 8, 24), goldMat);
  browBand.rotation.x = Math.PI / 2;
  browBand.position.set(0, 0.15, 0.01);
  group.add(browBand);

  const centerSpire = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.16, 6), goldMat);
  centerSpire.position.set(0, 0.23, 0.11);
  centerSpire.rotation.x = 0.15;
  group.add(centerSpire);

  const eyeGeo = new THREE.SphereGeometry(0.014, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.042, 0.085, 0.125);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.042, 0.085, 0.125);
  group.add(leftEye, rightEye);

  return group;
}

/**
 * Colossal Black Blade of Destined Death:
 * Built from the REAL sculpted 3D sword.glb (ZERO BoxGeometry!) enhanced into a dark
 * obsidian greatsword wrapped in an organic, undulating GLSL Destined Death fire sheath.
 */
function createColossalBlackBlade(swordTemplate, sharedLight) {
  const group = new THREE.Group();

  const colossalSword = swordTemplate.clone(true);
  colossalSword.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      const m = n.material.clone();
      m.color = new THREE.Color(0x231b22);
      m.metalness = 0.94;
      m.roughness = 0.25;
      m.emissive = new THREE.Color(0xc81224);
      m.emissiveIntensity = 0.35;
      n.material = m;
    }
  });
  // Sculpted colossal greatsword proportions directly from the real 3D mesh
  colossalSword.scale.set(1.65, 1.65, 1.75);
  group.add(colossalSword);

  // Organic FBM Destined Death black-and-crimson living fire aura hugging the real blade
  const aura = createOrganicBladeAura({
    length: 1.88,
    width: 0.56,
    zStart: 0.2,
    outerColor: new THREE.Color(3.4, 0.14, 0.24),
    coreColor: new THREE.Color(4.8, 1.45, 0.55),
    darkCore: true,
  });
  group.add(aura.group);

  let bladeLight = sharedLight;
  if (bladeLight === undefined) {
    bladeLight = new THREE.PointLight(0xff1e2d, 3.6, 13);
    bladeLight.position.set(0, 0, 1.25);
    group.add(bladeLight);
  }

  const bladeBase = new THREE.Object3D();
  bladeBase.position.set(0, 0, 0.24);
  group.add(bladeBase);

  const bladeTip = new THREE.Object3D();
  bladeTip.position.set(0, 0, 2.02);
  group.add(bladeTip);

  return { group, aura, bladeBase, bladeTip, bladeLight };
}

function createClipDriver(mixer, clips) {
  const actions = new Map();
  for (const [name, clip] of clips.entries()) {
    actions.set(name, mixer.clipAction(clip));
  }

  let currentName = null;
  let currentAction = null;

  function play(name, { loop = true, fade = 0.14, timeScale = 1.0, restart = false, clampWhenFinished = false } = {}) {
    const next = actions.get(name);
    if (!next) return null;

    if (currentName === name && !restart) {
      next.timeScale = timeScale;
      return next;
    }

    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = clampWhenFinished;
    next.timeScale = timeScale;
    next.enabled = true;
    next.setEffectiveWeight(1);

    if (currentAction && currentAction !== next) {
      currentAction.crossFadeTo(next, fade, false);
    }
    next.play();
    currentName = name;
    currentAction = next;
    return next;
  }

  return { play, actions };
}

function normalizeRig(rig, targetHeight) {
  rig.scale.setScalar(1);
  rig.position.set(0, 0, 0);
  rig.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(rig);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const k = targetHeight / Math.max(0.001, size.y);
  rig.scale.setScalar(k);
  rig.position.set(-center.x * k, -box.min.y * k, -center.z * k);
  rig.updateMatrixWorld(true);
  return { heightFactor: targetHeight / 1.78, height: size.y * k };
}

function buildClipMap(animations) {
  const map = new Map();
  for (const clip of animations ?? []) {
    if (clip?.name) map.set(clip.name, clip);
  }
  return map;
}

export async function loadEldenCharacters(onProgress = () => {}, { playerLight, bossLight } = {}) {
  const pack = await loadPackedEldenAssets(onProgress, "Forging armored rigs...", "Assembling Farum rigs...");

  const palette = buildMaterialPalette(pack.palette, false);

  const prepGltfProp = (obj) => {
    obj.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    return obj;
  };
  const swordTemplate = prepGltfProp(pack.sword);
  const scabbardTemplate = prepGltfProp(pack.scabbard);

  const playerFbx = pack.warrior;
  const bossFbx = cloneSkinned(playerFbx);
  const bakedClips = buildClipMap(pack.animations);

  // --- Dress Player (Tarnished) with authentic PBR armor palette ---
  playerFbx.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;

    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const mapped = mats.map((origMat) => {
      if (!origMat) return origMat;
      const authored = palette.resolve(origMat.name, node.name);
      if (authored) {
        const cloned = authored.clone();
        cloned.envMapIntensity = 1.3;
        return cloned;
      }
      return new THREE.MeshStandardMaterial({
        color: origMat.color ?? 0x7b8088,
        roughness: 0.45,
        metalness: 0.72,
      });
    });
    node.material = Array.isArray(node.material) ? mapped : mapped[0];
  });

  // --- Dress Boss (Maerith) with Obsidian-Gold Destined Death PBR transformation ---
  const bossEmissiveMats = [];
  bossFbx.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;

    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const mapped = mats.map((origMat) => {
      if (!origMat) return origMat;
      const authored = palette.resolve(origMat.name, node.name);
      const base = authored ? authored.clone() : new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.88 });
      base.color = new THREE.Color(0x63545c);
      base.metalness = Math.max(base.metalness ?? 0.5, 0.78);
      base.roughness = Math.min(base.roughness ?? 0.5, 0.38);
      base.envMapIntensity = 1.75;
      base.emissive = new THREE.Color(0x9a0b18);
      base.emissiveIntensity = 0.1;
      bossEmissiveMats.push(base);
      return base;
    });
    node.material = Array.isArray(node.material) ? mapped : mapped[0];
  });

  // =========================================================================
  // BUILD PLAYER MODEL (TARNISHED) WITH SACRED GOLDEN GRACE BLADE AURA
  // =========================================================================
  const playerRoot = new THREE.Group();
  const playerTilt = new THREE.Group();
  playerRoot.add(playerTilt);

  const { heightFactor: pFactor } = normalizeRig(playerFbx, 1.88);
  const playerBones = indexBones(playerFbx);
  const playerForwardYaw = measureRigForwardYaw(playerBones);
  playerFbx.rotation.y = -playerForwardYaw;
  playerTilt.add(playerFbx);

  const playerClips = bakedClips;

  const playerMixer = new THREE.AnimationMixer(playerFbx);
  const playerDriver = createClipDriver(playerMixer, playerClips);
  playerDriver.play("idle", { loop: true, fade: 0 });

  // Mount real sculpted 3D sword + organic Sacred Golden Grace Flame Aura in RightHand
  const playerSwordGroup = new THREE.Group();
  const playerSwordMesh = swordTemplate.clone(true);
  playerSwordMesh.traverse((n) => {
    if (n.isMesh) {
      const m = n.material.clone();
      m.emissive = new THREE.Color(0xd9922b);
      m.emissiveIntensity = 0.22;
      m.envMapIntensity = 1.5;
      n.material = m;
    }
  });
  playerSwordGroup.add(playerSwordMesh);

  const playerBladeAura = createOrganicBladeAura({
    length: 1.06,
    width: 0.3,
    zStart: 0.14,
    outerColor: new THREE.Color(2.7, 1.05, 0.22),
    coreColor: new THREE.Color(4.5, 3.1, 1.45),
    darkCore: false,
  });
  playerSwordGroup.add(playerBladeAura.group);

  const playerSwordLight = playerLight ?? new THREE.PointLight(0xffb84d, 1.8, 7.5);
  if (!playerLight) {
    playerSwordLight.position.set(0, 0, 0.72);
    playerSwordGroup.add(playerSwordLight);
  }

  const playerBladeBase = new THREE.Object3D();
  playerBladeBase.position.set(0, 0, 0.14);
  playerSwordGroup.add(playerBladeBase);
  const playerBladeTip = new THREE.Object3D();
  playerBladeTip.position.set(0, 0, 1.18);
  playerSwordGroup.add(playerBladeTip);

  attachToBone(
    playerBones.get("RightHand"),
    playerSwordGroup,
    { position: [-0.051, 0.102, 0.052], rotationDeg: [-168.3, 84, -0.8], scale: 1.08 },
    pFactor
  );

  // Mount real sculpted Scabbard on Hips
  attachToBone(
    playerBones.get("Hips"),
    scabbardTemplate.clone(true),
    { position: [0.14, 0.02, -0.02], rotationDeg: [0, 0, 20], scale: 1.0 },
    pFactor
  );

  // Mount curved metallic buckler shield on LeftForeArm (ZERO boxy edges!)
  const buckler = createCurvedBucklerShield();
  attachToBone(
    playerBones.get("LeftForeArm"),
    buckler.group,
    { position: [0.05, 0.11, 0.05], rotationDeg: [0, 90, 10], scale: 0.9 },
    pFactor
  );

  let prevPlayerState = "";
  let wardBlend = 0;

  const playerModel = {
    root: playerRoot,
    bladeBase: playerBladeBase,
    bladeTip: playerBladeTip,
    animate(state, progress, time, moveSpeed, dt = 0.016, stateDuration = 0.5) {
      playerTilt.position.set(0, 0, 0);
      playerTilt.rotation.set(0, 0, 0);

      const entered = state !== prevPlayerState;
      prevPlayerState = state;

      // Dynamic Golden Grace Flame Aura on Player's Blade (flares intensely on attacks!)
      const isSwinging = state === "light1" || state === "light2" || state === "heavy";
      const targetAura = state === "dead" ? 0.05 : isSwinging ? (state === "heavy" ? 1.85 : 1.45) : 0.92 + Math.sin(time * 5.2) * 0.12;
      playerBladeAura.update(time, targetAura);
      playerSwordLight.intensity = targetAura * 1.9;

      // Golden parry/guard rune ward smoothly lights up while blocking
      wardBlend += ((state === "block" ? 1 : 0) - wardBlend) * Math.min(1, dt * 12);
      buckler.wardMat.uniforms.uTime.value = time;
      buckler.wardMat.uniforms.uActive.value = wardBlend;

      if (state === "dead") {
        playerDriver.play("landing", { loop: false, fade: 0.16, timeScale: 0.7, clampWhenFinished: true });
        playerTilt.rotation.x = -Math.min(1, progress * 1.4) * (Math.PI / 2);
        playerTilt.position.y = 0.16 * Math.min(1, progress);
      } else if (state === "roll") {
        const clipDur = playerClips.get("bigJump")?.duration ?? 0.9;
        playerDriver.play("bigJump", {
          loop: false,
          fade: 0.06,
          timeScale: clipDur / Math.max(0.25, stateDuration),
          restart: entered,
        });
        playerTilt.rotation.x = progress * Math.PI * 2;
        playerTilt.position.y = Math.sin(progress * Math.PI) * 0.52 + 0.15;
      } else if (state === "light1") {
        const clipDur = playerClips.get("slash")?.duration ?? 0.9;
        playerDriver.play("slash", {
          loop: false,
          fade: 0.06,
          timeScale: (clipDur / Math.max(0.25, stateDuration)) * 1.05,
          restart: entered,
        });
      } else if (state === "light2") {
        const clipDur = playerClips.get("crouchSlash")?.duration ?? 0.9;
        playerDriver.play("crouchSlash", {
          loop: false,
          fade: 0.06,
          timeScale: (clipDur / Math.max(0.25, stateDuration)) * 1.05,
          restart: entered,
        });
      } else if (state === "heavy") {
        const clipDur = playerClips.get("jumpHit")?.duration ?? 1.1;
        playerDriver.play("jumpHit", {
          loop: false,
          fade: 0.08,
          timeScale: clipDur / Math.max(0.35, stateDuration),
          restart: entered,
        });
      } else if (state === "block") {
        playerDriver.play("crouch", { loop: true, fade: 0.1, timeScale: 1.0 });
      } else if (state === "grace_rest") {
        playerDriver.play("crouch", { loop: true, fade: 0.22, timeScale: 0.55 });
        playerSwordLight.intensity = 2.4 + Math.sin(progress * Math.PI) * 6.4;
      } else if (state === "heal") {
        playerDriver.play("idle", { loop: true, fade: 0.12, timeScale: 0.8 });
        playerSwordLight.intensity = 2.2 + Math.sin(progress * Math.PI) * 4.8;
      } else if (state === "hit") {
        playerDriver.play("kick", { loop: false, fade: 0.05, timeScale: 1.4, restart: entered });
        playerTilt.rotation.x = -0.22 * Math.sin(progress * Math.PI);
      } else if (moveSpeed > 0.2) {
        playerDriver.play("swordRun", {
          loop: true,
          fade: 0.14,
          timeScale: Math.max(0.85, moveSpeed / 5.2),
        });
      } else {
        playerDriver.play("idle", { loop: true, fade: 0.18, timeScale: 1.0 });
      }

      playerMixer.update(dt);
    },
  };

  // =========================================================================
  // BUILD BOSS MODEL (MAERITH, BLADE OF DESTINED DEATH)
  // =========================================================================
  const bossRoot = new THREE.Group();
  const bossTilt = new THREE.Group();
  bossRoot.add(bossTilt);

  const { heightFactor: bFactor } = normalizeRig(bossFbx, 3.45);
  const bossBones = indexBones(bossFbx);
  const bossForwardYaw = measureRigForwardYaw(bossBones);
  bossFbx.rotation.y = -bossForwardYaw;
  bossTilt.add(bossFbx);

  const bossClips = bakedClips;

  const bossMixer = new THREE.AnimationMixer(bossFbx);
  const bossDriver = createClipDriver(bossMixer, bossClips);
  bossDriver.play("idle", { loop: true, fade: 0 });

  const runeShaderMat = createDestinedDeathShaderMaterial();

  // Mount Colossal Black Blade with Organic GLSL Destined Death Flame Sheath
  const blackBlade = createColossalBlackBlade(swordTemplate, bossLight);
  attachToBone(
    bossBones.get("RightHand"),
    blackBlade.group,
    { position: [-0.051, 0.102, 0.052], rotationDeg: [-168.3, 84, -0.8], scale: 1.08 },
    bFactor
  );

  // Mount gilded curved horns, spiked demigod crown, and crimson eyes on Head bone
  const bossCrown = createMaerithCrownAndHorns();
  attachToBone(
    bossBones.get("Head"),
    bossCrown,
    { position: [0, 0.02, 0], rotationDeg: [0, 0, 0], scale: 1.05 },
    bFactor
  );

  // Sleek Destined Death chest rune embedded cleanly on Spine2
  const chestSeal = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), runeShaderMat);
  chestSeal.scale.set(0.65, 1.25, 0.25);
  attachToBone(
    bossBones.get("Spine2"),
    chestSeal,
    { position: [0, 0.06, 0.16], rotationDeg: [0, 0, 0], scale: 1.0 },
    bFactor
  );

  let prevBossState = "";
  let slashSecondTriggered = false;

  const bossModel = {
    root: bossRoot,
    bladeBase: blackBlade.bladeBase,
    bladeTip: blackBlade.bladeTip,
    animate(state, progress, time, isPhase2, moveSpeed, dt = 0.016, stateDuration = 1.4) {
      bossTilt.position.set(0, 0, 0);
      bossTilt.rotation.set(0, 0, 0);

      const entered = state !== prevBossState;
      prevBossState = state;
      if (entered) slashSecondTriggered = false;

      runeShaderMat.uniforms.uTime.value = time;
      const isDormant = state === "dormant";
      const flameIntensity = state === "dead"
        ? Math.max(0, 1 - progress)
        : isDormant
        ? 0.72 + Math.sin(time * 3.5) * 0.1
        : isPhase2
        ? 1.65 + Math.sin(time * 7.5) * 0.25
        : 1.08 + Math.sin(time * 5.2) * 0.14;

      runeShaderMat.uniforms.uIntensity.value = flameIntensity;
      blackBlade.aura.update(time, flameIntensity);
      if (blackBlade.bladeLight) {
        blackBlade.bladeLight.intensity = isPhase2 ? 7.2 + Math.sin(time * 9) * 1.0 : isDormant ? 2.6 : 4.2;
      }

      const armorGlow = isPhase2 ? 0.34 + Math.sin(time * 6) * 0.1 : 0.08;
      for (const m of bossEmissiveMats) m.emissiveIntensity = armorGlow;

      if (state === "dead") {
        bossDriver.play("landing", { loop: false, fade: 0.2, timeScale: 0.55, clampWhenFinished: true });
        const p = Math.min(1, progress);
        bossTilt.rotation.x = -p * (Math.PI / 2);
        bossTilt.position.y = (1 - p) * 0.25;
        if (blackBlade.bladeLight) blackBlade.bladeLight.intensity = Math.max(0, 3.6 * (1 - p));
      } else if (state === "dormant") {
        bossDriver.play("idle", { loop: true, fade: 0.25, timeScale: 0.65 });
      } else if (state === "staggered") {
        bossDriver.play("crouch", { loop: true, fade: 0.14, timeScale: 0.65 });
        bossTilt.rotation.x = 0.18;
      } else if (state === "phase_transition") {
        bossDriver.play("floating", { loop: true, fade: 0.22, timeScale: 1.0 });
        if (progress < 0.58) {
          const p = progress / 0.58;
          bossTilt.position.y = Math.sin(p * Math.PI * 0.5) * 2.15;
          blackBlade.aura.update(time, 1.5 + p * 1.4);
          if (blackBlade.bladeLight) blackBlade.bladeLight.intensity = 6.5 + p * 6.5;
        } else {
          const p = (progress - 0.58) / 0.42;
          bossTilt.position.y = 2.15 * Math.max(0, 1 - p * 1.35);
          blackBlade.aura.update(time, 2.3);
          if (blackBlade.bladeLight) blackBlade.bladeLight.intensity = 9.5;
        }
      } else if (state === "slash_combo") {
        if (progress < 0.56) {
          const clipDur = bossClips.get("slash")?.duration ?? 1.0;
          bossDriver.play("slash", {
            loop: false,
            fade: 0.08,
            timeScale: clipDur / Math.max(0.4, stateDuration * 0.56),
            restart: entered,
          });
        } else {
          const clipDur = bossClips.get("crouchSlash")?.duration ?? 0.9;
          bossDriver.play("crouchSlash", {
            loop: false,
            fade: 0.08,
            timeScale: clipDur / Math.max(0.35, stateDuration * 0.44),
            restart: !slashSecondTriggered,
          });
          slashSecondTriggered = true;
        }
      } else if (state === "overhead_slam") {
        const clipDur = bossClips.get("jumpHit")?.duration ?? 1.1;
        bossDriver.play("jumpHit", {
          loop: false,
          fade: 0.1,
          timeScale: clipDur / Math.max(0.45, stateDuration),
          restart: entered,
        });
      } else if (state === "leap_slam") {
        const clipDur = bossClips.get("jumpHit")?.duration ?? 1.1;
        bossDriver.play("jumpHit", {
          loop: false,
          fade: 0.08,
          timeScale: clipDur / Math.max(0.5, stateDuration),
          restart: entered,
        });
        const arc = Math.sin(Math.min(1, progress / 0.68) * Math.PI);
        bossTilt.position.y = arc * 4.8;
        bossTilt.rotation.x = progress < 0.64 ? Math.sin(progress * Math.PI) * 0.42 : 0.16;
      } else if (state === "destined_arc") {
        const clipDur = bossClips.get("slash")?.duration ?? 1.0;
        bossDriver.play("slash", {
          loop: false,
          fade: 0.08,
          timeScale: clipDur / Math.max(0.4, stateDuration),
          restart: entered,
        });
      } else if (state === "spin_frenzy") {
        bossDriver.play("crouchSlash", { loop: true, fade: 0.08, timeScale: 1.75 });
        bossTilt.rotation.y = progress * Math.PI * 6;
        bossTilt.position.y = Math.sin(progress * Math.PI) * 0.85;
      } else if (moveSpeed > 0.25) {
        if (isPhase2) {
          bossDriver.play("swordRun", { loop: true, fade: 0.16, timeScale: 0.88 });
        } else {
          bossDriver.play("walk", { loop: true, fade: 0.18, timeScale: 1.05 });
        }
      } else {
        bossDriver.play("idle", { loop: true, fade: 0.2, timeScale: 0.82 });
      }

      bossMixer.update(dt);
    },
  };

  onProgress(1, "Ready");
  return { playerModel, bossModel };
}

/**
 * Instant binary GLB loader for the standalone Maerith showcase page.
 * Shares warrior-opt.glb, textures-opt.glb, and sword-opt.glb with elden.html
 * so browser cache carries seamlessly across both pages.
 */
export async function loadMaerithShowcase(onProgress = () => {}) {
  const pack = await loadPackedEldenAssets(onProgress, "Memuat zirah obsidian...", "Merangkai Maerith...");

  const bossFbx = pack.warrior;
  const palette = buildMaterialPalette(pack.palette, false);
  const swordTemplate = pack.sword;
  swordTemplate.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });

  const bossEmissiveMats = [];
  bossFbx.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;

    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const mapped = mats.map((origMat) => {
      if (!origMat) return origMat;
      const authored = palette.resolve(origMat.name, node.name);
      const base = authored
        ? authored.clone()
        : new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.88 });
      base.color = new THREE.Color(0x63545c);
      base.metalness = Math.max(base.metalness ?? 0.5, 0.78);
      base.roughness = Math.min(base.roughness ?? 0.5, 0.36);
      base.envMapIntensity = 1.85;
      base.emissive = new THREE.Color(0x9a0b18);
      base.emissiveIntensity = 0.08;
      bossEmissiveMats.push(base);
      return base;
    });
    node.material = Array.isArray(node.material) ? mapped : mapped[0];
  });

  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);

  const { heightFactor } = normalizeRig(bossFbx, 3.45);
  const bones = indexBones(bossFbx);
  const forwardYaw = measureRigForwardYaw(bones);
  bossFbx.rotation.y = -forwardYaw;
  tilt.add(bossFbx);

  const clips = buildClipMap(pack.animations);
  const mixer = new THREE.AnimationMixer(bossFbx);
  const driver = createClipDriver(mixer, clips);
  driver.play("idle", { loop: true, fade: 0, timeScale: 0.82 });

  const runeShaderMat = createDestinedDeathShaderMaterial();
  const blackBlade = createColossalBlackBlade(swordTemplate, null);
  attachToBone(
    bones.get("RightHand"),
    blackBlade.group,
    { position: [-0.051, 0.102, 0.052], rotationDeg: [-168.3, 84, -0.8], scale: 1.08 },
    heightFactor
  );

  const crown = createMaerithCrownAndHorns();
  attachToBone(
    bones.get("Head"),
    crown,
    { position: [0, 0.02, 0], rotationDeg: [0, 0, 0], scale: 1.05 },
    heightFactor
  );

  const chestSeal = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), runeShaderMat);
  chestSeal.scale.set(0.65, 1.25, 0.25);
  attachToBone(
    bones.get("Spine2"),
    chestSeal,
    { position: [0, 0.06, 0.16], rotationDeg: [0, 0, 0], scale: 1.0 },
    heightFactor
  );

  let activeStance = "idle";

  function setStance(stance) {
    activeStance = stance;
    if (stance === "slash") {
      driver.play("slash", { loop: true, fade: 0.14, timeScale: 0.92, restart: true });
    } else if (stance === "slam") {
      driver.play("jumpHit", { loop: true, fade: 0.16, timeScale: 0.86, restart: true });
    } else if (stance === "ascend") {
      driver.play("floating", { loop: true, fade: 0.24, timeScale: 0.95, restart: true });
    } else {
      driver.play("idle", { loop: true, fade: 0.22, timeScale: 0.82 });
    }
  }

  function update(dt, time, isPhase2, paused) {
    runeShaderMat.uniforms.uTime.value = time;
    const targetFlame = isPhase2
      ? 1.18 + Math.sin(time * 7.0) * 0.16
      : 0.72 + Math.sin(time * 4.8) * 0.08;
    runeShaderMat.uniforms.uIntensity.value = targetFlame;
    blackBlade.aura.update(time, targetFlame);

    const armorGlow = isPhase2 ? 0.24 + Math.sin(time * 5.6) * 0.06 : 0.06;
    for (const m of bossEmissiveMats) m.emissiveIntensity = armorGlow;

    const targetLift = activeStance === "ascend" ? 0.52 + Math.sin(time * 2.1) * 0.14 : 0;
    tilt.position.y = THREE.MathUtils.lerp(tilt.position.y, targetLift, Math.min(1, dt * 5));

    if (!paused) mixer.update(dt);
  }

  onProgress(1, "Siap");
  return {
    root,
    bladeBase: blackBlade.bladeBase,
    bladeTip: blackBlade.bladeTip,
    setStance,
    update,
    isBladeTrailActive: () => activeStance === "slash" || activeStance === "slam",
  };
}
