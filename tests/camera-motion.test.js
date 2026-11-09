import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { sampleCameraMotion } from "../src/scene/camera-motion.js";

test("cinematic camera stays within its gentle motion budget without timeline jumps", () => {
  for (let time = 0; time < 180; time += 0.05) {
    const a = sampleCameraMotion(time, { x: 0, y: 0 }),
      b = sampleCameraMotion(time + 0.01, { x: 0, y: 0 });
    assert.ok(Math.abs(a.position.x) < 0.2);
    assert.ok(Math.abs(a.position.y) < 0.14);
    assert.ok(Math.abs(a.position.z - 15) < 0.2);
    for (const axis of ["x", "y", "z"])
      assert.ok(Math.abs(b.position[axis] - a.position[axis]) / 0.01 < 0.025);
    assert.ok(a.background.scale > 0.99 && a.background.scale < 1.01);
  }
});

test("parallax separates foreground, astronaut, and distant stars in depth order", () => {
  const camera = new PerspectiveCamera(
    (2 * Math.atan(4.5 / 15) * 180) / Math.PI,
    16 / 9,
    0.1,
    100,
  );
  function project(depth, pointer) {
    const pose = sampleCameraMotion(0, pointer);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    camera.updateMatrixWorld();
    return new Vector3(0, 0, depth).project(camera).x;
  }
  const shifts = [-35, 0, 6].map((depth) =>
    Math.abs(project(depth, { x: 0.5, y: 0 }) - project(depth, { x: 0, y: 0 })),
  );
  assert.ok(shifts[0] > 0);
  assert.ok(shifts[0] < shifts[1]);
  assert.ok(shifts[1] < shifts[2]);
});
