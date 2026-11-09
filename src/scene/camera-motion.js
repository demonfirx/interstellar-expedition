/** Slow, unbroken camera travel. Input is already damped by the scene. */
export function sampleCameraMotion(time, pointer = { x: 0, y: 0 }) {
  const x =
    0.16 * Math.sin(time * 0.085) +
    0.035 * Math.sin(time * 0.041) +
    pointer.x * 0.38;
  const y =
    0.11 * Math.sin(time * 0.068) +
    0.025 * Math.sin(time * 0.037) -
    pointer.y * 0.24;
  const z = 15 - 0.18 * Math.sin(time * 0.052);
  return {
    position: { x, y, z },
    target: { x: x * 0.94, y: y * 0.94, z: 0 },
    background: {
      x: x * 0.006,
      y: y * 0.006,
      scale: 1 + ((z - 15) / 15) * 0.18,
    },
  };
}
