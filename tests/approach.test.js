import test from "node:test";
import assert from "node:assert/strict";
import {
  createVoyageRoute,
  sampleSailingMotion,
  sampleSeaHeight,
} from "../src/models/sea-motion.js";
import { sampleApproach } from "../src/models/approach.js";
import { stepWordSpring } from "../src/ui/quote-physics.js";

test("black-hole approach grows monotonically while light and wave changes remain bounded", () => {
  for (const [base, aspect] of [
    [-1.8, 1.2],
    [-0.32, 390 / 844],
  ]) {
    const route = createVoyageRoute(base, aspect);
    let last = sampleApproach(0, route);
    for (let t = 0.25; t <= 1200; t += 0.25) {
      const now = sampleApproach(t, route);
      assert.ok(now.zoom >= last.zoom && now.zoom <= 1.85);
      assert.ok(now.lightGain >= 1 && now.lightGain <= 1.4);
      assert.ok(now.waveAmplitude >= 1 && now.waveAmplitude <= 1.7);
      assert.ok((now.zoom - last.zoom) / 0.25 < 0.01);
      const ship = sampleSailingMotion(t, base, aspect, route, now);
      assert.ok(
        Math.abs(ship.y - 0.16 - sampleSeaHeight(ship.x, ship.z, t, now)) <
          1e-8,
      );
      assert.ok(Math.abs(ship.pitch) < 0.15 && Math.abs(ship.roll) < 0.15);
      last = now;
    }
    assert.ok(sampleApproach(120, route).zoom > 1.2);
  }
});

test("wave phase stays continuous and never suddenly speeds up", () => {
  const route = createVoyageRoute(-1.8, 1.2);
  for (let t = 0; t < 900; t += 0.1) {
    const a = sampleApproach(t, route),
      b = sampleApproach(t + 0.01, route);
    const speed = (b.waveTime - a.waveTime) / 0.01;
    assert.ok(speed >= 1 && speed <= 1.3);
  }
});

test("quote words settle smoothly and consistently across frame rates", () => {
  function settle(hz) {
    const state = { x: 90, y: -40, vx: 120, vy: 60 };
    for (let i = 0; i < hz * 2; i++) stepWordSpring(state, 1 / hz);
    return state;
  }
  const a = settle(30),
    b = settle(120);
  for (const axis of ["x", "y", "vx", "vy"])
    assert.ok(Math.abs(a[axis] - b[axis]) < 1e-6);
  assert.ok(Math.abs(a.x) < 0.02 && Math.abs(a.y) < 0.02);
});
