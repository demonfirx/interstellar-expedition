/**
 * Pre-bakes tpose.fbx + all 13 Mixamo animation FBXs into a compact indexed
 * binary GLB (public/models/elden/warrior-opt.glb):
 * - Strips all 19 unused embedded FBX textures
 * - Deduplicates triangle-soup vertices into an indexed mesh (preserving groups,
 *   UVs, normals, skinIndex, and skinWeight)
 * - Pre-retargets all 13 skeletal animation clips directly onto bone names
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
  createElementNS: () => ({ style: {} }),
  createElement: () => ({ style: {} }),
};
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

THREE.TextureLoader.prototype.load = function () {
  return new THREE.Texture();
};

const MODELS_DIR = path.resolve("public/models/elden");
const ANIMATION_FILES = {
  idle: "animations/Idle.fbx",
  walk: "animations/Walk.fbx",
  run: "animations/Run.fbx",
  swordRun: "animations/SwordRun.fbx",
  crouch: "animations/Crouch.fbx",
  jump: "animations/Jump.fbx",
  bigJump: "animations/BigJump.fbx",
  slash: "animations/Slash.fbx",
  crouchSlash: "animations/Crouchslash.fbx",
  jumpHit: "animations/JumpHit.fbx",
  kick: "animations/Kick.fbx",
  landing: "animations/Landing.fbx",
  floating: "animations/floating.fbx",
};

/**
 * Deduplicates shared vertices of a non-indexed BufferGeometry while preserving
 * material groups, normals, UVs, skinIndex, and skinWeight cleanly.
 */
function deduplicateSkinnedGeometry(geom) {
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const uv = geom.attributes.uv;
  const skinIdx = geom.attributes.skinIndex;
  const skinWgt = geom.attributes.skinWeight;
  const count = pos.count;

  const map = new Map();
  const uniqueIndices = [];
  const indices = new Uint32Array(count);

  for (let i = 0; i < count; i++) {
    const px = Math.round(pos.getX(i) * 1000);
    const py = Math.round(pos.getY(i) * 1000);
    const pz = Math.round(pos.getZ(i) * 1000);
    const nx = norm ? Math.round(norm.getX(i) * 200) : 0;
    const ny = norm ? Math.round(norm.getY(i) * 200) : 0;
    const nz = norm ? Math.round(norm.getZ(i) * 200) : 0;
    const ux = uv ? Math.round(uv.getX(i) * 2000) : 0;
    const uy = uv ? Math.round(uv.getY(i) * 2000) : 0;
    const key = `${px},${py},${pz}|${nx},${ny},${nz}|${ux},${uy}`;

    let idx = map.get(key);
    if (idx === undefined) {
      idx = uniqueIndices.length;
      map.set(key, idx);
      uniqueIndices.push(i);
    }
    indices[i] = idx;
  }

  const uCount = uniqueIndices.length;
  const out = new THREE.BufferGeometry();

  const copyAttr = (attr, itemSize, ArrayType) => {
    const arr = new ArrayType(uCount * itemSize);
    for (let i = 0; i < uCount; i++) {
      const src = uniqueIndices[i] * itemSize;
      for (let k = 0; k < itemSize; k++) arr[i * itemSize + k] = attr.array[src + k];
    }
    return new THREE.BufferAttribute(arr, itemSize);
  };

  out.setAttribute("position", copyAttr(pos, 3, Float32Array));
  if (norm) out.setAttribute("normal", copyAttr(norm, 3, Float32Array));
  if (uv) out.setAttribute("uv", copyAttr(uv, 2, Float32Array));
  if (skinIdx) out.setAttribute("skinIndex", copyAttr(skinIdx, 4, Uint16Array));
  if (skinWgt) out.setAttribute("skinWeight", copyAttr(skinWgt, 4, Float32Array));

  const indexArray = uCount <= 65535 ? new Uint16Array(indices) : indices;
  out.setIndex(new THREE.BufferAttribute(indexArray, 1));

  for (const g of geom.groups) {
    out.addGroup(g.start, g.count, g.materialIndex);
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
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

function measureClipUnits(clip, bones) {
  const hipsName = bones.get("Hips")?.name ?? null;
  const ratios = [];
  for (const track of clip.tracks) {
    if (!track.name.endsWith(".position") || track.values.length < 3) continue;
    const nodeName = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
    if (nodeName === hipsName) continue;
    const bone = bones.get(nodeName);
    if (!bone) continue;
    const clipLen = Math.hypot(track.values[0], track.values[1], track.values[2]);
    const bindLen = bone.position.length();
    if (clipLen < 1e-6 || bindLen < 1e-6) continue;
    ratios.push(bindLen / clipLen);
  }
  if (!ratios.length) return 1;
  ratios.sort((a, b) => a - b);
  const ratio = ratios[ratios.length >> 1];
  return ratio > 0.5 && ratio < 2 ? 1 : ratio;
}

function retargetClip(sourceFbx, clipName, bones) {
  const clip = (sourceFbx?.animations ?? [])[0];
  if (!clip) return null;

  const unitScale = measureClipUnits(clip, bones);
  const hipsName = bones.get("Hips")?.name ?? null;
  const hipsBind = bones.get("Hips");
  const tracks = [];

  for (const original of clip.tracks) {
    const track = original.clone();
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    const bone = bones.get(parsed.nodeName);
    if (!bone) continue;

    track.name = `${bone.name}.${parsed.propertyName}`;

    if (track.name.endsWith(".position")) {
      const vals = track.values;
      if (unitScale !== 1) {
        for (let i = 0; i < vals.length; i++) vals[i] *= unitScale;
      }
      if (bone.name === hipsName) {
        const bx = hipsBind ? hipsBind.position.x : vals[0];
        const bz = hipsBind ? hipsBind.position.z : vals[2];
        for (let i = 0; i < vals.length; i += 3) {
          vals[i] = bx;
          vals[i + 2] = bz;
        }
      }
    }
    tracks.push(track);
  }

  return tracks.length ? new THREE.AnimationClip(clipName, clip.duration, tracks) : null;
}

async function parseFbxFile(loader, relPath) {
  const buf = await readFile(path.join(MODELS_DIR, relPath));
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return loader.parse(arrayBuffer, "");
}

async function main() {
  const loader = new FBXLoader();
  console.log("Parsing tpose.fbx...");
  const baseFbx = await parseFbxFile(loader, "tpose.fbx");

  const cleanMats = new Map();
  baseFbx.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    const beforeVerts = node.geometry.attributes.position.count;
    const oldGeo = node.geometry;
    node.geometry = deduplicateSkinnedGeometry(oldGeo);
    oldGeo.dispose();
    const afterVerts = node.geometry.attributes.position.count;
    console.log(`  Indexed ${node.name}: ${beforeVerts} -> ${afterVerts} vertices (${(beforeVerts / afterVerts).toFixed(2)}x fewer)`);

    const list = Array.isArray(node.material) ? node.material : [node.material];
    const mapped = list.map((orig) => {
      const name = orig?.name || node.name || "default_mat";
      if (!cleanMats.has(name)) {
        cleanMats.set(
          name,
          new THREE.MeshStandardMaterial({
            name,
            color: orig?.color ? orig.color.clone() : new THREE.Color(0x7b8088),
            roughness: 0.45,
            metalness: 0.72,
          })
        );
      }
      return cleanMats.get(name);
    });
    node.material = Array.isArray(node.material) ? mapped : mapped[0];
  });

  const bones = indexBones(baseFbx);
  const clips = [];
  for (const [name, relPath] of Object.entries(ANIMATION_FILES)) {
    const animFbx = await parseFbxFile(loader, relPath);
    const clip = retargetClip(animFbx, name, bones);
    if (clip) clips.push(clip);
  }

  const glb = await new GLTFExporter().parseAsync(baseFbx, {
    binary: true,
    animations: clips,
  });

  const outPath = path.join(MODELS_DIR, "warrior-opt.glb");
  await writeFile(outPath, Buffer.from(glb));
  console.log(
    `Exported warrior-opt.glb: ${(glb.byteLength / 1048576).toFixed(2)} MB (${clips.length} clips).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
