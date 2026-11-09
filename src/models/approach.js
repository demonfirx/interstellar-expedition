import { sampleVoyagePosition } from "./sea-motion.js";

/** One distance-driven envelope shared by the sky, water, craft and reflections. */
export function sampleApproach(time, route, out = {}, point = {}) {
  const t = Math.max(0, time);
  sampleVoyagePosition(t, route, point);
  const initial = Math.hypot(route.goalX - route.startX, route.goalZ);
  const ratio = Math.max(
    0,
    Math.min(
      1,
      Math.hypot(route.goalX - point.x, route.goalZ - point.z) / initial,
    ),
  );
  const proximity = 1 - Math.pow(ratio, 1.4),
    envelope = proximity * (2 - proximity);
  // Integrated speed curves keep phases continuous rather than multiplying time by a changing gain.
  const integrated = t - 220 * (1 - Math.exp(-t / 220));
  const frame = Math.max(0, Math.min(1, ((route.aspect ?? 1.2) - 0.6) / 0.7));
  const growth = 0.55 + 0.3 * frame * frame * (3 - 2 * frame);
  out.proximity = proximity;
  out.envelope = envelope;
  out.zoom = 1 + growth * envelope;
  out.lightGain = 1 + 0.34 * envelope;
  out.waveAmplitude = 1 + 0.6 * envelope;
  out.waveTime = t + 0.28 * integrated;
  out.flowTime = t + 0.16 * integrated;
  out.windTime = t + 0.12 * integrated;
  out.wakeGain = 1 + 0.25 * envelope;
  out.glowGain = 1 + 0.25 * envelope;
  return out;
}
