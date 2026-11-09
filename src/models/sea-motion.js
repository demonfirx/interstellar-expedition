export const SEA_LEVEL = -1.95;
export function sampleSeaHeight(x, z, time) {
  return (
    0.04 * Math.sin(x * 0.9 + z * 0.32 - time * 0.5) +
    0.022 * Math.sin(z * 0.8 - x * 0.21 + time * 0.4)
  );
}
export function sampleSailingMotion(time, baseX) {
  const x =
      baseX + 0.36 * Math.sin(time * 0.045) + 0.035 * Math.sin(time * 0.31),
    z = 0.16 * Math.sin(time * 0.07);
  const fore = sampleSeaHeight(x + 0.65, z, time),
    aft = sampleSeaHeight(x - 0.65, z, time);
  const port = sampleSeaHeight(x, z + 0.3, time),
    starboard = sampleSeaHeight(x, z - 0.3, time);
  return {
    x,
    y: 0.16 + sampleSeaHeight(x, z, time),
    z,
    pitch: Math.atan2(fore - aft, 1.3),
    roll: -Math.atan2(port - starboard, 0.6),
    yaw: -0.24 + 0.045 * Math.sin(time * 0.16),
  };
}
