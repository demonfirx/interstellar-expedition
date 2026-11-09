import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { createFollowCameraRig } from "../src/scene/follow-camera.js";
import {
  createVoyageRoute,
  sampleSailingMotion,
  SEA_LEVEL,
} from "../src/models/sea-motion.js";

test("follow camera stays behind the moving ship without sharp position changes", () => {
  for (const [baseX, aspect] of [
    [-1.8, 1.2],
    [-0.32, 390 / 844],
  ]) {
    const route = createVoyageRoute(baseX, aspect),
      rig = createFollowCameraRig();
    let last;
    for (let frame = 0; frame < 18000; frame++) {
      const time = frame / 30,
        ship = sampleSailingMotion(time, baseX, aspect, route);
      const pose = rig.update(
        time,
        1 / 30,
        route,
        aspect,
        { x: 0, y: 0 },
        0,
        false,
      );
      const dx = pose.position.x - ship.x,
        dz = pose.position.z - ship.z;
      assert.ok(dx * Math.cos(ship.yaw) - dz * Math.sin(ship.yaw) < -1);
      assert.ok(Math.hypot(dx, dz) > 9 && Math.hypot(dx, dz) < 18);
      assert.ok(pose.position.y > SEA_LEVEL + 1);
      if (last)
        assert.ok(
          Math.hypot(
            pose.position.x - last.x,
            pose.position.y - last.y,
            pose.position.z - last.z,
          ) *
            30 <
            0.65,
        );
      last = { ...pose.position };
    }
  }
});

test("ship and mast remain framed in desktop and portrait chase views", () => {
  for (const [baseX, aspect] of [
    [-1.8, 1.2],
    [-0.32, 390 / 844],
  ]) {
    const route = createVoyageRoute(baseX, aspect),
      rig = createFollowCameraRig();
    const camera = new PerspectiveCamera(
      (2 * Math.atan(4.5 / 15) * 180) / Math.PI,
      aspect,
      0.1,
      100,
    );
    for (let frame = 0; frame < 9000; frame++) {
      const time = frame / 30,
        pose = rig.update(
          time,
          1 / 30,
          route,
          aspect,
          { x: 0, y: 0 },
          0,
          false,
        );
      if (frame % 300 !== 0) continue;
      const ship = sampleSailingMotion(time, baseX, aspect, route);
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      camera.updateMatrixWorld();
      for (const y of [
        SEA_LEVEL + ship.y,
        SEA_LEVEL + ship.y + 3.02 * (aspect < 0.9 ? 0.57 : 0.72),
      ]) {
        const ndc = new Vector3(ship.x, y, ship.z).project(camera);
        assert.ok(Math.abs(ndc.x) < 0.8);
        assert.ok(ndc.y > -0.86 && ndc.y < 0.86);
      }
    }
  }
});

test("pause freezes camera position and angle until playback resumes", () => {
  const route = createVoyageRoute(-1.8, 1.2),
    rig = createFollowCameraRig();
  for (let frame = 0; frame <= 600; frame++)
    rig.update(frame / 30, 1 / 30, route, 1.2, { x: 0, y: 0 }, 0, false);
  const before = structuredClone(
    rig.update(20, 1 / 30, route, 1.2, { x: 0, y: 0 }, 0, true),
  );
  for (let i = 0; i < 30; i++)
    assert.deepEqual(
      rig.update(20, 1 / 30, route, 1.2, { x: 0.5, y: 0.5 }, 0.3, true),
      before,
    );
});
