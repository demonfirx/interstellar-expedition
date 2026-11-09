import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  createAstronaut,
  createAnimationClips,
} from "../src/models/astronaut.js";

test("voxel astronaut has a valid rigid-weighted skeleton and readable limbs", () => {
  const { mesh, bones } = createAstronaut();
  assert.ok(mesh.isSkinnedMesh);
  assert.ok(mesh.skeleton.bones.length >= 16);
  assert.equal(bones.L_arm_lower.parent, bones.L_arm_upper);
  assert.equal(bones.L_hand.parent, bones.L_arm_lower);
  const weights = mesh.geometry.getAttribute("skinWeight");
  const indices = mesh.geometry.getAttribute("skinIndex");
  for (let i = 0; i < weights.count; i++) {
    assert.equal(
      weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i),
      1,
    );
    assert.ok(indices.getX(i) < mesh.skeleton.bones.length);
  }
  assert.ok(mesh.geometry.getAttribute("position").count > 1000);
});

test("suit and visor have separate complete render groups with valid shading normals", () => {
  const { mesh } = createAstronaut();
  const geometry = mesh.geometry;
  assert.equal(geometry.groups.length, 2);
  assert.ok(Array.isArray(mesh.material));
  let next = 0;
  for (const group of geometry.groups) {
    assert.equal(group.start, next);
    assert.ok(group.count > 0);
    assert.ok(mesh.material[group.materialIndex]);
    next += group.count;
  }
  assert.equal(next, geometry.attributes.position.count);
  const normals = geometry.attributes.normal;
  for (let i = 0; i < normals.count; i++)
    assert.ok(
      Math.abs(
        Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1,
      ) < 1e-5,
    );
});

test("downloadable GLB preserves its skeleton and both animation clips", async () => {
  const file = await readFile(
    new URL("../public/models/astro-rigged.glb", import.meta.url),
  );
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  let skin;
  gltf.scene.traverse((object) => {
    if (object.isSkinnedMesh) skin = object;
  });
  assert.ok(skin);
  assert.equal(skin.skeleton.bones.length, 16);
  assert.deepEqual(
    gltf.animations.map((a) => a.name),
    ["AN_Astro_Float", "AN_Astro_Wave"],
  );
  assert.ok(file.byteLength < 350000);
});

test("floating and waving clips loop cleanly and never scale bones", () => {
  const clips = createAnimationClips();
  assert.deepEqual(
    clips.map((c) => c.name),
    ["AN_Astro_Float", "AN_Astro_Wave"],
  );
  for (const clip of clips) {
    assert.ok(clip.duration > 0);
    assert.ok(clip.tracks.length >= 3);
    for (const track of clip.tracks) {
      assert.ok(!track.name.includes("scale"));
      const size = track.getValueSize();
      assert.deepEqual(
        Array.from(track.values.slice(0, size)),
        Array.from(track.values.slice(-size)),
      );
    }
  }
});
