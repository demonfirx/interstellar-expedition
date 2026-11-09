import { SEA_LEVEL, sampleVoyagePosition } from "../models/sea-motion.js";

/** Rear-quarter tracking with bounded turning speed and independent position/aim damping. */
export function createFollowCameraRig() {
  const pose = {
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    background: { x: 0, y: 0, scale: 1 },
  };
  const current = {},
    following = {},
    headingSample = {};
  let initialized = false,
    lastAspect = 0,
    heading = 0;
  const approach = (from, to, rate, dt) =>
    from + (to - from) * (1 - Math.exp(-rate * dt));
  return {
    update(
      time,
      dt,
      route,
      aspect,
      pointer = { x: 0, y: 0 },
      orbit = 0,
      paused = false,
    ) {
      const reframe = !initialized || Math.abs(aspect - lastAspect) > 0.001;
      if (paused && !reframe) return pose;
      sampleVoyagePosition(time, route, current);
      sampleVoyagePosition(time - 1.8, route, following);
      sampleVoyagePosition(time - 3.5, route, headingSample);
      const desiredHeading = Math.atan2(
        -headingSample.tangentZ,
        headingSample.tangentX,
      );
      if (reframe) heading = desiredHeading;
      else {
        const difference = Math.atan2(
          Math.sin(desiredHeading - heading),
          Math.cos(desiredHeading - heading),
        );
        const step = difference * (1 - Math.exp(-dt * 0.65));
        heading += Math.max(-dt * 0.02, Math.min(dt * 0.02, step));
      }
      const portrait = aspect < 0.9;
      const angle = heading + orbit + 0.018 * Math.sin(time * 0.065);
      const forwardX = Math.cos(angle),
        forwardZ = -Math.sin(angle),
        sideX = -forwardZ,
        sideZ = forwardX;
      const distance = (portrait ? 12.2 : 12.8) + 0.14 * Math.sin(time * 0.052);
      const side =
        (portrait ? 4.3 : 5) + 0.16 * Math.sin(time * 0.06) + pointer.x * 0.45;
      const height =
        (portrait ? 2.35 : 2.45) +
        0.035 * Math.sin(time * 0.11) -
        pointer.y * 0.28;
      const lookAhead = portrait ? 1.6 : 1.8;
      const px = following.x - forwardX * distance + sideX * side;
      const py = SEA_LEVEL + 0.16 + height;
      const pz = following.z - forwardZ * distance + sideZ * side;
      const tx =
        current.x + current.tangentX * lookAhead + sideX * pointer.x * 0.1;
      const ty = SEA_LEVEL + 0.16 + (portrait ? 1.45 : 1.55) - pointer.y * 0.06;
      const tz =
        current.z + current.tangentZ * lookAhead + sideZ * pointer.x * 0.1;
      pose.position.x = reframe ? px : approach(pose.position.x, px, 0.85, dt);
      pose.position.y = reframe ? py : approach(pose.position.y, py, 0.75, dt);
      pose.position.z = reframe ? pz : approach(pose.position.z, pz, 0.85, dt);
      pose.target.x = reframe ? tx : approach(pose.target.x, tx, 1.15, dt);
      pose.target.y = reframe ? ty : approach(pose.target.y, ty, 1.1, dt);
      pose.target.z = reframe ? tz : approach(pose.target.z, tz, 1.15, dt);
      pose.background.x = 0.004 * Math.sin(heading) + pointer.x * 0.002;
      pose.background.y = 0.0008 * Math.sin(time * 0.055) + pointer.y * 0.001;
      pose.background.scale = 0.992 + 0.005 * Math.sin(time * 0.04);
      initialized = true;
      lastAspect = aspect;
      return pose;
    },
  };
}
