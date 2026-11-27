/**
 * Packs the four optimized Elden GLBs into ONE compact meshopt-compressed file:
 *   public/models/elden/elden-pack.glb
 *
 * Scenes (by name): "warrior" (skinned rig + 13 clips), "palette" (PBR armor
 * materials), "sword", "scabbard".
 *
 * - Deduplicates identical accessors (shared animation key times), textures, materials
 * - Resamples animation curves (drops redundant linear keyframes)
 * - Re-encodes textures to WebP (base color 1024px, data maps 512px)
 * - Quantizes + compresses geometry/animation with EXT_meshopt_compression
 *
 * Run: node scripts/pack-elden-glb.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  mergeDocuments,
  meshopt,
  prune,
  resample,
  textureCompress,
  unpartition,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "models", "elden");
const SOURCES = [
  ["warrior", "warrior-opt.glb"],
  ["palette", "textures-opt.glb"],
  ["sword", "sword-opt.glb"],
  ["scabbard", "scabbard-opt.glb"],
];

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

let doc = null;
for (const [name, file] of SOURCES) {
  const src = await io.read(path.join(DIR, file));
  const scenes = src.getRoot().listScenes();
  scenes.forEach((s, i) => s.setName(i === 0 ? name : `${name}_${i}`));
  if (!doc) {
    doc = src;
  } else {
    mergeDocuments(doc, src);
  }
}

const root = doc.getRoot();
root.setDefaultScene(root.listScenes().find((s) => s.getName() === "warrior"));

for (const tex of root.listTextures()) {
  const size = tex.getSize();
  console.log(`  texture ${tex.getName() || tex.getURI() || "?"} ${size?.join("x")} ${tex.getMimeType()}`);
}

await doc.transform(
  unpartition(),
  dedup(),
  resample({ tolerance: 2e-4 }),
  prune({ keepLeaves: false, keepAttributes: true }),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    slots: /^(baseColorTexture|emissiveTexture)$/,
    resize: [512, 512],
    quality: 74,
  }),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    slots: /^(?!baseColorTexture|emissiveTexture).*/,
    resize: [384, 384],
    quality: 72,
  }),
  dedup(),
  meshopt({ encoder: MeshoptEncoder, level: "high" })
);

const out = path.join(DIR, "elden-pack.glb");
await io.write(out, doc);

const { statSync } = await import("node:fs");
console.log(
  `Exported elden-pack.glb: ${(statSync(out).size / 1024).toFixed(0)} KB | scenes=${root
    .listScenes()
    .map((s) => s.getName())
    .join(",")} | clips=${root.listAnimations().length} | textures=${root.listTextures().length}`
);
