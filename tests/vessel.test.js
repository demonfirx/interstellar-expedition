import test from "node:test";
import assert from "node:assert/strict";
import { createSailingVessel } from "../src/models/sailing-vessel.js";
import {
  sampleSailingMotion,
  sampleSeaHeight,
  createVoyageRoute,
  sampleVoyagePosition,
} from "../src/models/sea-motion.js";

test("sailing vessel has a finite hull, two sails, and reflective cabin windows", () => {
  const vessel = createSailingVessel();
  assert.ok(vessel.root.isGroup);
  assert.equal(vessel.sails.length, 2);
  assert.ok(vessel.reflectors.length >= 2);
  let vertices = 0;
  vessel.root.traverse((o) => {
    if (!o.geometry) return;
    const positions = o.geometry.attributes.position;
    vertices += positions.count;
    for (const value of positions.array) assert.ok(Number.isFinite(value));
    const normal = o.geometry.attributes.normal;
    for (let i = 0; i < normal.count; i++)
      assert.ok(
        Math.abs(
          Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1,
        ) < 1e-4,
      );
  });
  assert.ok(vertices > 400);
  vessel.root.updateMatrixWorld(true);
  assert.ok(vessel.materials.some((m) => m.isMeshPhysicalMaterial));
});

test("voyage approaches the black hole continuously and bow follows its course", () => {
  for (const [baseX, aspect] of [
    [-1.8, 1.2],
    [-0.32, 390 / 844],
  ]) {
    const route = createVoyageRoute(baseX, aspect);
    let previous = Infinity;
    for (let time = 0; time < 900; time += 0.5) {
      const point = sampleVoyagePosition(time, route);
      const distance = Math.hypot(route.goalX - point.x, route.goalZ - point.z);
      assert.ok(distance <= previous + 1e-7);
      previous = distance;
      const pose = sampleSailingMotion(time, baseX, aspect, route);
      const speed = Math.hypot(point.velocityX, point.velocityZ);
      assert.ok(
        (Math.cos(pose.yaw) * point.velocityX -
          Math.sin(pose.yaw) * point.velocityZ) /
          speed >
          0.999,
      );
    }
    assert.ok(sampleVoyagePosition(90, route).z < -2);
  }
});

test("wake history starts smoothly and stays behind the sailing vessel", () => {
  const route = createVoyageRoute(-1.8, 1.2);
  const before = sampleVoyagePosition(-0.01, route),
    start = sampleVoyagePosition(0, route),
    after = sampleVoyagePosition(0.01, route);
  for (const axis of ["x", "z"])
    assert.ok(
      Math.abs(after[axis] - start[axis] - (start[axis] - before[axis])) < 1e-5,
    );
  for (let time = 0; time < 120; time += 1) {
    const current = sampleVoyagePosition(time, route),
      past = sampleVoyagePosition(time - 45, route);
    assert.ok(past.x < current.x);
  }
});

test("ship follows the ocean surface with slow, bounded motion", () => {
  for (let t = 0; t < 180; t += 0.05) {
    const pose = sampleSailingMotion(t, -1.5),
      next = sampleSailingMotion(t + 0.01, -1.5);
    assert.ok(
      Math.abs(pose.y - sampleSeaHeight(pose.x, pose.z, t) - 0.16) < 1e-8,
    );
    assert.ok(Math.abs(pose.pitch) < 0.1);
    assert.ok(Math.abs(pose.roll) < 0.1);
    for (const axis of ["x", "y", "z"])
      assert.ok(Math.abs(next[axis] - pose[axis]) / 0.01 < 0.15);
  }
});
