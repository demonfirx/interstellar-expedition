import assert from "node:assert/strict";
import test from "node:test";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from "three";
import { sampleSurface } from "../src/archive/surface.js";

function triangle(size, x) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    0, 0, 0, size, 0, 0, 0, size, 0,
  ], 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.position.x = x;
  return mesh;
}

test("hologram samples cover transformed faces in proportion to their surface area", () => {
  const model = new Group();
  const arm = new Group();
  arm.position.set(0, 2, -3);
  arm.add(triangle(1, -4), triangle(3, 2));
  model.add(arm);

  const points = sampleSurface(model, 2000);
  assert.equal(points.length, 6000);
  assert.deepEqual(points, sampleSurface(model, 2000));
  let onLargerFace = 0;
  for (let i = 0; i < points.length; i += 3) {
    const [x, y, z] = points.subarray(i, i + 3);
    assert.equal(z, -3);
    assert.ok(y >= 2);
    if (x >= 2) {
      onLargerFace++;
      assert.ok(x + y <= 7.000001);
    } else {
      assert.ok(x >= -4 && x <= -3 && x + y <= -0.999999);
    }
  }
  assert.ok(onLargerFace >= 1700 && onLargerFace <= 1900);
});
