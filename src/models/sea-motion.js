export const SEA_LEVEL = -1.95;
export function sampleSeaHeight(x, z, time) {
  return (
    0.04 * Math.sin(x * 0.9 + z * 0.32 - time * 0.5) +
    0.022 * Math.sin(z * 0.8 - x * 0.21 + time * 0.4)
  );
}
export function createVoyageRoute(baseX, aspect = 1.2) {
  const imageAspect = 16 / 9,
    fitX = Math.min(1, aspect / imageAspect),
    fitY = Math.min(1, imageAspect / aspect);
  const blend = Math.max(0, Math.min(1, (aspect - 0.75) / 0.65));
  const originX = 0.615 + (0.5 - 0.615) * blend * blend * (3 - 2 * blend);
  const holeU = (0.626 - originX) / (0.975 * fitX),
    holeV = (0.442 - 0.5) / (0.975 * fitY);
  const depth = (SEA_LEVEL + 0.16) / (holeV * 0.6);
  const goalX = holeU * depth * 0.6 * aspect,
    goalZ = 15 - depth,
    dx = goalX - baseX;
  return {
    startX: baseX,
    firstX: baseX + Math.min(3, Math.max(0.25, dx * 0.8)),
    firstZ: -0.025,
    secondX: goalX - dx * 0.2,
    secondZ: goalZ * 0.32,
    goalX,
    goalZ,
  };
}

/** A slow approach with no timer wrap; negative time supplies a continuous wake history. */
export function sampleVoyagePosition(time, route, out = {}) {
  const duration = 220;
  let x, z, dx, dz, rate;
  if (time < 0) {
    dx = 3 * (route.firstX - route.startX);
    dz = 3 * route.firstZ;
    rate = 1 / duration;
    x = route.startX + dx * rate * time;
    z = dz * rate * time;
  } else {
    const u = 1 - Math.exp(-time / duration),
      v = 1 - u;
    rate = v / duration;
    x =
      v * v * v * route.startX +
      3 * v * v * u * route.firstX +
      3 * v * u * u * route.secondX +
      u * u * u * route.goalX;
    z =
      3 * v * v * u * route.firstZ +
      3 * v * u * u * route.secondZ +
      u * u * u * route.goalZ;
    dx =
      3 *
      (v * v * (route.firstX - route.startX) +
        2 * v * u * (route.secondX - route.firstX) +
        u * u * (route.goalX - route.secondX));
    dz =
      3 *
      (v * v * route.firstZ +
        2 * v * u * (route.secondZ - route.firstZ) +
        u * u * (route.goalZ - route.secondZ));
  }
  out.x = x;
  out.z = z;
  out.velocityX = dx * rate;
  out.velocityZ = dz * rate;
  const length = Math.hypot(dx, dz);
  out.tangentX = dx / length;
  out.tangentZ = dz / length;
  return out;
}

export function sampleSailingMotion(
  time,
  baseX,
  aspect = 1.2,
  route = createVoyageRoute(baseX, aspect),
) {
  const course = sampleVoyagePosition(time, route),
    { x, z } = course,
    forwardX = course.tangentX,
    forwardZ = course.tangentZ;
  const fore = sampleSeaHeight(x + 0.65 * forwardX, z + 0.65 * forwardZ, time),
    aft = sampleSeaHeight(x - 0.65 * forwardX, z - 0.65 * forwardZ, time);
  const port = sampleSeaHeight(x - 0.3 * forwardZ, z + 0.3 * forwardX, time),
    starboard = sampleSeaHeight(x + 0.3 * forwardZ, z - 0.3 * forwardX, time);
  return {
    x,
    y: 0.16 + sampleSeaHeight(x, z, time),
    z,
    pitch: Math.atan2(fore - aft, 1.3),
    roll: -Math.atan2(port - starboard, 0.6),
    yaw: Math.atan2(-forwardZ, forwardX),
  };
}
