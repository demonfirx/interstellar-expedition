import test from "node:test";
import assert from "node:assert/strict";
import { createQuoteCycle } from "../src/ui/quote-cycle.js";

test("automatic quotes allow sixteen seconds of reading between transitions", () => {
  for (const hz of [30, 60, 120]) {
    const cycle = createQuoteCycle();
    let first = null;
    for (let i = 1; i <= 17 * hz; i++) {
      if (cycle.advance(1 / hz)) {
        first = i / hz;
        break;
      }
    }
    assert.ok(first >= 16 - 1e-6 && first <= 16 + 1 / hz + 1e-6);
  }
});

test("hover, focus, dragging, settling and paused autoplay restart the reading window", () => {
  const cycle = createQuoteCycle();
  for (let i = 0; i < 150; i++) assert.equal(cycle.advance(0.1), false);
  for (let i = 0; i < 1000; i++) assert.equal(cycle.advance(0.1, true), false);
  for (let i = 0; i < 150; i++) assert.equal(cycle.advance(0.1), false);
  cycle.restart();
  for (let i = 0; i < 150; i++) assert.equal(cycle.advance(0.1), false);
  let advances = 0;
  for (let i = 0; i < 20; i++) advances += Number(cycle.advance(0.1));
  assert.equal(advances, 1);
});

test("a suspended tab or invalid clock cannot skip a quote", () => {
  const cycle = createQuoteCycle();
  for (const dt of [NaN, Infinity, -1, 0, 3600])
    assert.equal(cycle.advance(dt), false);
  for (let i = 0; i < 140; i++) assert.equal(cycle.advance(0.1), false);
});
