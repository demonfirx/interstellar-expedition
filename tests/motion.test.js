import test from "node:test";
import assert from "node:assert/strict";
import { greetingPose, sampleFloat } from "../src/models/motion.js";

test("greeting includes a relaxed pause, a raised wave, and a seamless return", () => {
  const start = greetingPose(0),
    raised = greetingPose(3),
    rested = greetingPose(8.5);
  assert.ok(raised.upper[2] - start.upper[2] > 1.5);
  assert.ok(Math.abs(rested.upper[2] - start.upper[2]) < 0.02);
  assert.deepEqual(greetingPose(9), start);
  assert.ok(
    Math.abs(greetingPose(3).lower[2] - greetingPose(3.5).lower[2]) > 0.1,
  );
});

test("wave and floating paths have bounded speed without jumps at cycle boundaries", () => {
  const step = 0.01;
  let previous = greetingPose(0);
  for (let time = step; time <= 18; time += step) {
    const current = greetingPose(time);
    for (const part of ["upper", "lower", "wrist", "head"])
      for (let axis = 0; axis < 3; axis++)
        assert.ok(
          Math.abs(current[part][axis] - previous[part][axis]) / step < 3,
        );
    previous = current;
  }
  for (let time = 0; time < 60; time += step) {
    const a = sampleFloat(time),
      b = sampleFloat(time + step);
    for (const axis of ["x", "y", "z"])
      assert.ok(Math.abs(a.position[axis] - b.position[axis]) / step < 0.2);
  }
});
