const TAU = Math.PI * 2;
function smoothstep(from, to, value) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Nine-second greeting: anticipation, lift, three waves, settle, and rest. */
export function greetingPose(seconds) {
  const t = ((seconds % 9) + 9) % 9;
  const lift = smoothstep(0.4, 1.85, t) * (1 - smoothstep(6.25, 8.05, t));
  const moving = smoothstep(1.9, 2.5, t) * (1 - smoothstep(5.6, 6.25, t));
  const phase = (t - 2.35) * TAU * 0.73;
  const anticipation =
    Math.sin(Math.PI * smoothstep(0, 0.65, t)) * (1 - lift) * 0.055;
  return {
    upper: [
      0.035 + 0.045 * lift,
      0.04 * lift,
      0.22 +
        1.94 * lift -
        anticipation +
        0.028 * moving * Math.sin(phase - 0.5),
    ],
    lower: [
      -0.05 + 0.08 * lift,
      0,
      -0.12 + 0.6 * lift + 0.3 * moving * Math.sin(phase),
    ],
    wrist: [
      0.085 * moving * Math.sin(phase - 0.45),
      0.045 * moving * Math.sin(phase - 0.65),
      0.17 * moving * Math.sin(phase - 0.65),
    ],
    head: [
      0.015 + 0.025 * lift,
      0.04 * lift,
      -0.025 - 0.055 * lift + 0.018 * moving * Math.sin(phase - 0.8),
    ],
  };
}

/** Slowly changing arcs and phase offsets keep drift continuous, including while paused. */
export function sampleFloat(time) {
  return {
    position: {
      x: 0.19 * Math.sin(time * 0.29) + 0.045 * Math.sin(time * 0.63 + 0.4),
      y:
        0.22 * Math.sin(time * 0.43 + 0.2) +
        0.055 * Math.sin(time * 0.71 + 0.7),
      z: 0.07 * Math.sin(time * 0.31 + 0.8),
    },
    rotation: {
      x: 0.08 + 0.045 * Math.sin(time * 0.43 - 0.4),
      y: -0.32 + 0.065 * Math.sin(time * 0.29 - 0.9),
      z:
        -0.19 +
        0.07 * Math.sin(time * 0.29 - 0.55) +
        0.016 * Math.sin(time * 0.63),
    },
  };
}
