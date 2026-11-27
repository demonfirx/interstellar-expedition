import * as THREE from "three";
import { createArenaFloorTextures, createTempleStoneTextures } from "./materials.js";

export const ARENA_RADIUS = 23.5;

export const PILLAR_COLLIDERS = [
  { x: 15.6, z: 0, r: 1.55 },
  { x: -15.6, z: 0, r: 1.55 },
  { x: 7.8, z: 13.5, r: 1.55 },
  { x: -7.8, z: 13.5, r: 1.55 },
  { x: 7.8, z: -13.5, r: 1.55 },
  { x: -7.8, z: -13.5, r: 1.55 },
];

/**
 * Sculpted fluted temple shaft geometry (real vertical flutes carved into cylinder).
 */
function createFlutedColumnGeometry(radiusTop, radiusBottom, height, flutes = 16) {
  const radialSegs = flutes * 4;
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegs, 8, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.1) {
      const ang = Math.atan2(z, x);
      // Taper flutes cleanly near top & bottom collars
      const yNorm = Math.abs(y) / (height * 0.5);
      const fluteMask = THREE.MathUtils.smoothstep(1.0 - yNorm, 0.04, 0.14);
      const fluteDepth = Math.max(0, Math.cos(ang * flutes)) * 0.085 * fluteMask;
      const scale = (r - fluteDepth) / r;
      pos.setX(i, x * scale);
      pos.setZ(i, z * scale);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Extruded Gothic pointed arch silhouette for crumbling perimeter colonnade & floating ruins.
 */
function createGothicArchGeometry(span = 4.8, height = 5.4, thickness = 0.85) {
  const outer = new THREE.Shape();
  const hw = span * 0.5;
  outer.moveTo(-hw, 0);
  outer.lineTo(-hw, height * 0.58);
  outer.quadraticCurveTo(-hw * 0.95, height * 0.95, 0, height);
  outer.quadraticCurveTo(hw * 0.95, height * 0.95, hw, height * 0.58);
  outer.lineTo(hw, 0);
  outer.lineTo(hw - 0.65, 0);
  outer.lineTo(hw - 0.65, height * 0.54);
  outer.quadraticCurveTo((hw - 0.65) * 0.85, height * 0.83, 0, height - 0.72);
  outer.quadraticCurveTo(-(hw - 0.65) * 0.85, height * 0.83, -(hw - 0.65), height * 0.54);
  outer.lineTo(-(hw - 0.65), 0);
  outer.closePath();

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.08,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -thickness * 0.5);
  return geo;
}

/**
 * 360-degree Crumbling Farum Azula tempest sky dome shader:
 * golden storm clouds, distant swirling tornado vortex, flickering amber/crimson lightning,
 * and a divine sun-break that shifts into Destined Death blood-crimson during Phase 2.
 */
function createTempestSkyDome() {
  const geo = new THREE.SphereGeometry(135, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPhase2: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform float uTime;
      uniform float uPhase2;

      float hash(vec2 p) {
        vec3 h = fract(vec3(p.xyx) * 0.1031);
        h += dot(h, h.yzx + 33.33);
        return fract((h.x + h.y) * h.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = mat2(1.6, 1.2, -1.2, 1.6) * p;
          a *= 0.48;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        float elev = d.y;
        float azim = atan(d.x, d.z);

        // Seamless 3D swirling Farum Azula tempest clouds (zero atan seam at -Z!)
        float ca = cos(uTime * 0.045);
        float sa = sin(uTime * 0.045);
        vec3 rd = vec3(d.x * ca - d.z * sa, d.y, d.x * sa + d.z * ca);
        vec2 cUv1 = rd.xz * 2.6 + vec2(rd.y * 2.1, -rd.y * 1.4);
        vec2 cUv2 = vec2(rd.x * 1.9 - rd.z * 2.2, rd.y * 3.8 + uTime * 0.03);
        float swirl = fbm(cUv1 + vec2(fbm(cUv2 * 1.4) * 1.35, rd.y * 1.2));
        float detail = fbm(cUv2 * 2.4 + vec2(swirl * 1.6, -uTime * 0.06));

        // Base sky palette: moody Farum Azula tempest gold/charcoal in P1 -> blood-crimson eclipse in P2
        vec3 zenithP1 = vec3(0.035, 0.032, 0.048);
        vec3 midP1 = vec3(0.14, 0.10, 0.075);
        vec3 horizonP1 = vec3(0.36, 0.22, 0.11);

        vec3 zenithP2 = vec3(0.04, 0.01, 0.016);
        vec3 midP2 = vec3(0.20, 0.032, 0.042);
        vec3 horizonP2 = vec3(0.48, 0.075, 0.09);

        vec3 zenith = mix(zenithP1, zenithP2, uPhase2);
        vec3 mid = mix(midP1, midP2, uPhase2);
        vec3 horizon = mix(horizonP1, horizonP2, uPhase2);

        float horizonBand = exp(-abs(elev + 0.01) * 5.8);
        vec3 sky = mix(mid, zenith, smoothstep(0.05, 0.68, elev));
        sky = mix(sky, horizon, horizonBand * 0.8);

        // Deep abyss darkening below horizon
        float abyssMask = smoothstep(-0.04, -0.45, elev);
        sky = mix(sky, vec3(0.02, 0.014, 0.012), abyssMask * 0.9);

        // Illuminated golden storm cloud ridges with strong contrast
        vec3 cloudLit = mix(vec3(0.76, 0.49, 0.24), vec3(0.98, 0.16, 0.20), uPhase2);
        float cloudMask = smoothstep(0.34, 0.82, swirl * 0.7 + detail * 0.3) * smoothstep(-0.22, 0.12, elev);
        sky = mix(sky, sky * 0.45 + cloudLit * (0.24 + horizonBand * 0.36), cloudMask * 0.82);

        // Distant towering Farum Azula tornado column looming clearly behind the boss
        vec3 tornDir = normalize(vec3(-0.22, 0.0, -0.975));
        float tornAng = atan(d.x * tornDir.z - d.z * tornDir.x, d.x * tornDir.x + d.z * tornDir.z);
        float funnelWidth = 0.085 + max(0.0, elev + 0.18) * 0.44;
        float funnel = exp(-pow(tornAng / max(0.02, funnelWidth), 2.0)) * smoothstep(-0.32, 0.02, elev) * (1.0 - smoothstep(0.48, 0.85, elev));
        float vortexStripes = fbm(vec2(tornAng * 14.0 + elev * 10.0 - uTime * 0.9, elev * 11.0));
        vec3 funnelDark = mix(vec3(0.045, 0.036, 0.034), vec3(0.07, 0.012, 0.018), uPhase2);
        vec3 funnelGlow = mix(vec3(0.92, 0.56, 0.22), vec3(1.45, 0.16, 0.22), uPhase2);
        sky = mix(sky, funnelDark + funnelGlow * smoothstep(0.45, 0.82, vortexStripes) * 0.48, funnel * 0.88);

        // Occasional distant lightning flash inside the storm funnel
        float boltSeed = floor(uTime * 1.6);
        float flashPulse = pow(max(0.0, sin(uTime * 1.6 * 3.14159)), 14.0) * step(0.68, hash(vec2(boltSeed, 3.7)));
        sky += funnelGlow * funnel * flashPulse * 0.95;

        // Restrained golden sun-break glow (never blows out the horizon to white)
        vec3 sunDir = normalize(vec3(0.42, 0.36, -0.83));
        float sunDot = max(0.0, dot(d, sunDir));
        vec3 sunCol = mix(vec3(0.88, 0.56, 0.26), vec3(1.15, 0.18, 0.18), uPhase2);
        sky += sunCol * (pow(sunDot, 16.0) * 0.28 + pow(sunDot, 110.0) * 0.52);

        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -50;
  return { mesh, mat };
}

/**
 * Custom GLSL animated brazier flame shader (layered glowing flame tongue).
 */
function createBrazierFlameMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPhase2: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        float sway = sin(uTime * 7.5 + position.y * 5.0 + position.x * 3.0) * 0.12 * uv.y;
        p.x += sway;
        p.z += cos(uTime * 6.2 + position.y * 4.5) * 0.09 * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uPhase2;
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float wobble = sin(y * 10.0 - uTime * 9.5) * 0.18 * y;
        float shape = 1.0 - smoothstep(0.0, 1.0 - y * 0.72, abs(x + wobble));
        shape *= smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.45, 1.0, y));
        vec3 outerP1 = vec3(2.2, 0.52, 0.08);
        vec3 innerP1 = vec3(3.6, 1.85, 0.55);
        vec3 outerP2 = vec3(2.6, 0.10, 0.16);
        vec3 innerP2 = vec3(3.4, 0.55, 0.35);
        vec3 col = mix(mix(outerP1, outerP2, uPhase2), mix(innerP1, innerP2, uPhase2), smoothstep(0.35, 0.9, shape));
        gl_FragColor = vec4(col, shape * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function buildArena(scene) {
  const group = new THREE.Group();

  // Atmospheric exponential fog tuned to Farum Azula tempest haze (clear enough to see the storm vortex)
  scene.fog = new THREE.FogExp2(0x16110e, 0.0085);

  // 360 Tempest Sky Dome
  const skyDome = createTempestSkyDome();
  scene.add(skyDome.mesh);

  // Cinematic 3-point + storm bounce lighting
  const hemiLight = new THREE.HemisphereLight(0xf3c68a, 0x261d1c, 0.95);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffcf8c, 2.75);
  sunLight.position.set(22, 34, -26);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 6;
  sunLight.shadow.camera.far = 96;
  const d = 29;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);

  // Cool tempest backlight to carve crisp armor rim silhouettes
  const rimLight = new THREE.DirectionalLight(0x88a2cc, 1.25);
  rimLight.position.set(-26, 15, 22);
  scene.add(rimLight);

  // Phase 2 Destined Death crimson overhead atmosphere light
  const crimsonLight = new THREE.PointLight(0xff1a2b, 0.0, 62, 1.25);
  crimsonLight.position.set(0, 14, 0);
  scene.add(crimsonLight);

  // Procedural PBR materials
  const floorTex = createArenaFloorTextures();
  const stoneTex = createTempleStoneTextures(2, 4);
  const blockStoneTex = createTempleStoneTextures(1.5, 1.5);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex.map,
    normalMap: floorTex.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: floorTex.roughnessMap,
    metalnessMap: floorTex.metalnessMap,
    roughness: 0.92,
    metalness: 0.88,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex.map,
    normalMap: stoneTex.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.86,
    metalness: 0.08,
  });

  const blockStoneMat = new THREE.MeshStandardMaterial({
    map: blockStoneTex.map,
    normalMap: blockStoneTex.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.88,
    metalness: 0.06,
  });

  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x322b26,
    normalMap: blockStoneTex.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.9,
    metalness: 0.12,
  });

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xc59a4a,
    roughness: 0.34,
    metalness: 0.9,
    clearcoat: 0.25,
  });

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x5c462c,
    roughness: 0.48,
    metalness: 0.82,
  });

  // Main circular carved coliseum deck + stepped temple under-foundation
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 1.35, ARENA_RADIUS + 1.85, 1.4, 72),
    floorMat
  );
  floor.position.y = -0.7;
  floor.receiveShadow = true;
  group.add(floor);

  const underTier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 1.1, ARENA_RADIUS - 1.8, 4.2, 48),
    darkStoneMat
  );
  underTier1.position.y = -3.4;
  group.add(underTier1);

  const underTier2 = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS - 2.6, ARENA_RADIUS - 8.0, 7.5, 32),
    darkStoneMat
  );
  underTier2.position.y = -9.1;
  group.add(underTier2);

  // Stepped circular outer stone curb & gilded bronze trim rings
  const outerCurb = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_RADIUS + 1.05, 0.42, 10, 72),
    darkStoneMat
  );
  outerCurb.rotation.x = Math.PI / 2;
  outerCurb.position.y = 0.08;
  outerCurb.receiveShadow = true;
  group.add(outerCurb);

  const gildedRim = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_RADIUS + 0.58, 0.14, 10, 72),
    goldMat
  );
  gildedRim.rotation.x = Math.PI / 2;
  gildedRim.position.y = 0.14;
  group.add(gildedRim);

  // Subtle carved central dais step ring (visual focus where Maerith & Tarnished clash)
  const daisRing = new THREE.Mesh(
    new THREE.TorusGeometry(6.8, 0.09, 8, 64),
    goldMat
  );
  daisRing.rotation.x = Math.PI / 2;
  daisRing.position.y = 0.03;
  group.add(daisRing);

  // Perimeter Gothic Ruined Colonnade (skip south bay i=6 so the Grand Bridge opens cleanly!)
  const archGeo = createGothicArchGeometry(4.9, 6.2, 0.85);
  const parapetCount = 24;
  for (let i = 0; i < parapetCount; i++) {
    if (i === 6) continue; // South entrance portal connects to the Farum Azula Grand Skybridge
    const ang = (i / parapetCount) * Math.PI * 2;
    const px = Math.cos(ang) * (ARENA_RADIUS + 1.05);
    const pz = Math.sin(ang) * (ARENA_RADIUS + 1.05);

    if (i % 3 === 0 && i !== 18) {
      const arch = new THREE.Mesh(archGeo, blockStoneMat);
      arch.position.set(px, -0.05, pz);
      arch.rotation.y = -ang + Math.PI / 2;
      arch.castShadow = true;
      arch.receiveShadow = true;
      group.add(arch);
    } else if (i % 4 !== 1) {
      const h = 1.05 + (i % 3) * 0.42;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.85, h, 0.82), blockStoneMat);
      wall.position.set(px, h * 0.5, pz);
      wall.rotation.y = -ang + Math.PI / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.18, 0.98), darkStoneMat);
      cap.position.set(px, h + 0.08, pz);
      cap.rotation.y = -ang + Math.PI / 2;
      group.add(cap);
    }
  }

  // =========================================================================
  // EXPLORATION APPROACH: GRAND SKYBRIDGE, SITE OF GRACE TERRACE & GOLDEN MIST
  // =========================================================================
  const exploreGroup = new THREE.Group();

  // Grand Crumbling Skybridge connecting South Portal (z=23.2) to Site of Grace Terrace (z=33.5)
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.35, 11.4), blockStoneMat);
  bridgeDeck.position.set(0, -0.68, 28.4);
  bridgeDeck.receiveShadow = true;
  exploreGroup.add(bridgeDeck);

  // Gilded bronze bridge edge trims & stone curb rails
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 11.4), darkStoneMat);
    curb.position.set(side * 4.35, 0.25, 28.4);
    curb.castShadow = true;
    curb.receiveShadow = true;
    exploreGroup.add(curb);

    const railGold = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 11.2), goldMat);
    railGold.position.set(side * 4.02, 0.06, 28.4);
    exploreGroup.add(railGold);

    // Bridge under-buttresses descending into the storm abyss
    for (const bz of [25.6, 30.8]) {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.85, 8.5, 8), darkStoneMat);
      pier.position.set(side * 3.7, -5.0, bz);
      exploreGroup.add(pier);
    }
  }

  // Circular Site of Grace Terrace (center z = 40.0, radius = 9.0)
  const terraceDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(9.0, 9.6, 1.4, 56),
    floorMat
  );
  terraceDeck.position.set(0, -0.7, 40.0);
  terraceDeck.receiveShadow = true;
  exploreGroup.add(terraceDeck);

  const terraceUnder = new THREE.Mesh(
    new THREE.CylinderGeometry(8.2, 4.2, 6.5, 32),
    darkStoneMat
  );
  terraceUnder.position.set(0, -4.6, 40.0);
  exploreGroup.add(terraceUnder);

  const terraceRim = new THREE.Mesh(new THREE.TorusGeometry(8.75, 0.12, 8, 56), goldMat);
  terraceRim.rotation.x = Math.PI / 2;
  terraceRim.position.set(0, 0.08, 40.0);
  exploreGroup.add(terraceRim);

  // Broken perimeter stone parapet around the southern semicircle of the Terrace
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // Leave north opening toward bridge clear
    if (Math.sin(a) < -0.55) continue;
    if (i % 3 === 1) continue;
    const tx = Math.cos(a) * 8.85;
    const tz = 40.0 + Math.sin(a) * 8.85;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.05, 0.72), blockStoneMat);
    wall.position.set(tx, 0.52, tz);
    wall.rotation.y = -a + Math.PI / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    exploreGroup.add(wall);
  }

  // Monumental Gothic Boss Fog Portal Archway at z = 23.6
  const portalArchGeo = createGothicArchGeometry(8.2, 9.4, 1.3);
  const portalArch = new THREE.Mesh(portalArchGeo, blockStoneMat);
  portalArch.position.set(0, -0.05, 23.6);
  portalArch.castShadow = true;
  portalArch.receiveShadow = true;
  exploreGroup.add(portalArch);

  const portalPillarGeo = createFlutedColumnGeometry(0.75, 0.88, 6.2, 12);
  for (const side of [-1, 1]) {
    const col = new THREE.Mesh(portalPillarGeo, stoneMat);
    col.position.set(side * 4.15, 3.1, 23.6);
    col.castShadow = true;
    exploreGroup.add(col);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.08, 8, 20), goldMat);
    band.rotation.x = Math.PI / 2;
    band.position.set(side * 4.15, 2.2, 23.6);
    exploreGroup.add(band);
  }

  // Shimmering Custom GLSL Golden Fog Wall (Traverse the Mist!)
  const fogWallMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPhase2: { value: 0 },
      uOpacity: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uPhase2;
      uniform float uOpacity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.04;
          a *= 0.48;
        }
        return v;
      }

      void main() {
        if (uOpacity <= 0.01) discard;
        // Arch shape silhouette mask so golden mist fits inside the Gothic portal
        float x = (vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float archMaxX = y < 0.58 ? 0.96 : sqrt(max(0.0, 1.0 - pow((y - 0.58) / 0.42, 2.0))) * 0.96;
        float archMask = 1.0 - smoothstep(archMaxX - 0.14, archMaxX, abs(x));
        archMask *= smoothstep(0.0, 0.06, y);

        vec2 flow = vec2(vUv.x * 3.8, vUv.y * 4.2 - uTime * 0.55);
        float mist = fbm(flow + vec2(fbm(flow * 1.4 + uTime * 0.25) * 1.1, 0.0));
        float streaks = fbm(vec2(vUv.x * 9.0, vUv.y * 2.2 - uTime * 1.1));
        float veil = (0.38 + 0.62 * mist) * (0.72 + 0.28 * streaks);

        vec3 goldMist = mix(vec3(1.05, 0.62, 0.18), vec3(1.65, 1.08, 0.42), smoothstep(0.38, 0.85, mist));
        vec3 crimsonMist = mix(vec3(1.25, 0.12, 0.18), vec3(2.1, 0.42, 0.28), smoothstep(0.42, 0.85, mist));
        vec3 col = mix(goldMist, crimsonMist, uPhase2);

        float alpha = archMask * veil * 0.54 * uOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const fogWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 8.6), fogWallMat);
  fogWallMesh.position.set(0, 4.3, 23.6);
  fogWallMesh.renderOrder = 5;
  exploreGroup.add(fogWallMesh);

  // Iconic Elden Ring Site of Grace at (0, 40.0) — twisted dark roots + ethereal golden grace flame
  const graceGroup = new THREE.Group();
  graceGroup.position.set(0, 0, 40.0);

  const rootMat = new THREE.MeshStandardMaterial({ color: 0x1e1714, roughness: 0.92, metalness: 0.08 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.55, 0.0, Math.sin(a) * 0.55),
      new THREE.Vector3(Math.cos(a + 0.25) * 0.28, 0.24, Math.sin(a + 0.25) * 0.28),
      new THREE.Vector3(Math.cos(a + 0.5) * 0.08, 0.56, Math.sin(a + 0.5) * 0.08),
    ]);
    const branch = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.032, 6, false), rootMat);
    graceGroup.add(branch);
  }

  // Soft ethereal floating Site of Grace flame + guidance light beam pointing toward the Fog Gate
  const graceFlameMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.x += sin(uv.y * 7.0 - uTime * 5.2) * 0.08 * uv.y;
        p.z += cos(uv.y * 6.0 - uTime * 4.4) * 0.06 * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float flicker = 0.86 + 0.14 * sin(uTime * 8.0 + y * 10.0);
        float core = exp(-x * x * 16.0) * smoothstep(0.0, 0.16, y) * (1.0 - smoothstep(0.35, 1.0, y));
        float halo = exp(-(x * x * 4.2 + (y - 0.35) * (y - 0.35) * 5.0)) * 0.45;
        vec3 col = mix(vec3(2.4, 1.55, 0.42), vec3(4.2, 3.3, 1.85), clamp(core * 1.4, 0.0, 1.0));
        gl_FragColor = vec4(col * flicker, (core + halo) * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const gracePlaneGeo = new THREE.PlaneGeometry(0.95, 1.75, 4, 12);
  const gf1 = new THREE.Mesh(gracePlaneGeo, graceFlameMat);
  gf1.position.y = 1.05;
  const gf2 = new THREE.Mesh(gracePlaneGeo, graceFlameMat);
  gf2.position.y = 1.05;
  gf2.rotation.y = Math.PI / 2;
  graceGroup.add(gf1, gf2);

  // Guidance of Grace golden wisp ribbon arching north toward Maerith's Fog Gate
  const guideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.15, 0),
    new THREE.Vector3(0.35, 2.35, -3.5),
    new THREE.Vector3(-0.2, 3.1, -8.5),
    new THREE.Vector3(0, 3.8, -14.2),
  ]);
  const guideTube = new THREE.Mesh(
    new THREE.TubeGeometry(guideCurve, 28, 0.045, 6, false),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.6, 1.85, 0.65),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  graceGroup.add(guideTube);

  const graceLight = new THREE.PointLight(0xffcb66, 6.2, 16, 1.4);
  graceLight.position.set(0, 1.45, 0);
  graceGroup.add(graceLight);

  exploreGroup.add(graceGroup);
  group.add(exploreGroup);

  // 6 Massive Fluted Gothic Pillars (strictly preserving PILLAR_COLLIDERS x, z, r!)
  const tallShaftGeo = createFlutedColumnGeometry(1.16, 1.32, 13.4, 16);
  const brokenShaftGeo = createFlutedColumnGeometry(1.22, 1.32, 8.6, 16);

  PILLAR_COLLIDERS.forEach((p, idx) => {
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(p.x, 0, p.z);

    // Stepped octagonal stone plinth
    const plinthLow = new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.84, 0.62, 8), darkStoneMat);
    plinthLow.position.y = 0.31;
    plinthLow.castShadow = true;
    plinthLow.receiveShadow = true;
    pillarGroup.add(plinthLow);

    const plinthTop = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.62, 0.48, 8), blockStoneMat);
    plinthTop.position.y = 0.86;
    plinthTop.castShadow = true;
    plinthTop.receiveShadow = true;
    pillarGroup.add(plinthTop);

    // Molded torus base collar
    const baseTorus = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.18, 10, 24), goldMat);
    baseTorus.rotation.x = Math.PI / 2;
    baseTorus.position.y = 1.18;
    pillarGroup.add(baseTorus);

    const isTall = idx % 2 === 0;
    const shaftH = isTall ? 13.4 : 8.6;
    const shaft = new THREE.Mesh(isTall ? tallShaftGeo : brokenShaftGeo, stoneMat);
    shaft.position.y = 1.2 + shaftH * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    pillarGroup.add(shaft);

    // Engraved bronze & gold ceremonial bands encircling the shaft
    for (const bandY of [3.2, 6.8]) {
      if (bandY < shaftH + 0.5) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.08, 8, 28), goldMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = bandY;
        pillarGroup.add(ring);
      }
    }

    if (isTall) {
      // Tiered gothic capital + abacus slab
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.18, 0.85, 8), blockStoneMat);
      neck.position.y = 1.2 + shaftH + 0.42;
      neck.castShadow = true;
      pillarGroup.add(neck);

      const abacus = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.45, 3.25), darkStoneMat);
      abacus.position.y = 1.2 + shaftH + 1.05;
      abacus.castShadow = true;
      pillarGroup.add(abacus);
    } else {
      // Shattered diagonal masonry break on ruined pillars
      const shard1 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.24, 1.5, 9), blockStoneMat);
      shard1.position.set(0.12, 1.2 + shaftH + 0.45, -0.08);
      shard1.rotation.set(0.24, 0.6, -0.18);
      pillarGroup.add(shard1);

      const shard2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.1), darkStoneMat);
      shard2.position.set(-0.26, 1.2 + shaftH + 0.25, 0.2);
      shard2.rotation.set(-0.35, 0.4, 0.28);
      pillarGroup.add(shard2);
    }

    group.add(pillarGroup);
  });

  // 6 Sacred Iron Braziers around the coliseum perimeter + 4 flanking the Grand Approach Bridge
  const flameMat = createBrazierFlameMaterial();
  const brazierLights = [];
  const brazierSpots = [
    ...[0.28, 1.22, 2.02, 3.42, 4.44, 5.45].map((ang) => ({
      x: Math.cos(ang) * (ARENA_RADIUS - 0.5),
      z: Math.sin(ang) * (ARENA_RADIUS - 0.5),
    })),
    { x: -3.9, z: 26.5 },
    { x: 3.9, z: 26.5 },
    { x: -3.9, z: 32.5 },
    { x: 3.9, z: 32.5 },
  ];
  brazierSpots.forEach((spot, idx) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(spot.x, 0, spot.z);

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.54, 1.65, 8), bronzeMat);
    stand.position.y = 0.82;
    stand.castShadow = true;
    bGroup.add(stand);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.34, 0.52, 10), bronzeMat);
    bowl.position.y = 1.82;
    bGroup.add(bowl);

    const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.06, 8, 18), goldMat);
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.position.y = 2.06;
    bGroup.add(bowlRim);

    // Crossed animated flame billboards
    const flameGeo = new THREE.PlaneGeometry(1.15, 1.95, 4, 8);
    const f1 = new THREE.Mesh(flameGeo, flameMat);
    f1.position.y = 2.75;
    const f2 = new THREE.Mesh(flameGeo, flameMat);
    f2.position.y = 2.75;
    f2.rotation.y = Math.PI * 0.5;
    bGroup.add(f1, f2);

    // Warm local firelight on alternate braziers (keeps GPU light count lean & fast!)
    if (idx % 2 === 0) {
      const pLight = new THREE.PointLight(0xff8c33, 5.5, 18, 1.6);
      pLight.position.set(0, 2.9, 0);
      bGroup.add(pLight);
      brazierLights.push({ light: pLight, phase: idx * 1.7 });
    }

    group.add(bGroup);
  });

  // Distant Floating Crumbling Farum Azula Temple Ruin Spires (broken columns, buttress shards & temple cornices)
  const floatingRuins = [];
  const ruinColumnGeo = createFlutedColumnGeometry(0.75, 0.88, 6.4, 12);
  const ruinSlabGeo = new THREE.BoxGeometry(6.2, 0.85, 3.2);
  const ruinSpireGeo = new THREE.CylinderGeometry(0.18, 1.35, 7.2, 7);

  for (let i = 0; i < 22; i++) {
    const dist = 54 + (i % 6) * 9.0 + Math.random() * 7;
    const ang = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const y = -4 + Math.random() * 28;

    const ruinGroup = new THREE.Group();
    if (i % 3 === 0) {
      // Shattered temple bridge deck with gilded cornice + broken stub columns
      const deck = new THREE.Mesh(ruinSlabGeo, blockStoneMat);
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.22, 3.45), goldMat);
      cornice.position.y = 0.5;
      const stub = new THREE.Mesh(ruinColumnGeo, stoneMat);
      stub.scale.set(0.65, 0.55, 0.65);
      stub.position.set(-1.5, 2.0, 0);
      ruinGroup.add(deck, cornice, stub);
    } else if (i % 3 === 1) {
      // Tilted broken fluted column drum with stepped plinth
      const c = new THREE.Mesh(ruinColumnGeo, stoneMat);
      c.rotation.z = 0.35 + (i % 4) * 0.14;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.8, 8), darkStoneMat);
      base.position.y = -2.8;
      ruinGroup.add(c, base);
    } else {
      // Tall jagged gothic spire monolith drifting in the tempest
      const spire = new THREE.Mesh(ruinSpireGeo, darkStoneMat);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 6, 12), goldMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = -1.2;
      ruinGroup.add(spire, collar);
    }

    const sc = 0.8 + (i % 4) * 0.32;
    ruinGroup.scale.setScalar(sc);
    ruinGroup.position.set(Math.cos(ang) * dist, y, Math.sin(ang) * dist);
    ruinGroup.rotation.set(
      (Math.random() - 0.5) * 0.35,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.35
    );
    group.add(ruinGroup);

    floatingRuins.push({
      mesh: ruinGroup,
      dist,
      ang,
      y,
      speed: (0.018 + (i % 5) * 0.008) * (i % 2 === 0 ? 1 : -1),
      bobSpeed: 0.26 + (i % 4) * 0.12,
    });
  }

  // Soft Glowing Circular Ember & Ash Particle Shader (NO ugly square PointsMaterial pixels!)
  const particleCount = 460;
  const pPos = new Float32Array(particleCount * 3);
  const pSeed = new Float32Array(particleCount);
  const pScale = new Float32Array(particleCount);
  const pVel = [];
  for (let i = 0; i < particleCount; i++) {
    const r = Math.sqrt(Math.random()) * (ARENA_RADIUS + 11);
    const a = Math.random() * Math.PI * 2;
    pPos[i * 3] = Math.cos(a) * r;
    pPos[i * 3 + 1] = Math.random() * 18;
    pPos[i * 3 + 2] = Math.sin(a) * r;
    pSeed[i] = Math.random();
    pScale[i] = 0.55 + Math.random() * 1.45;
    pVel.push({
      vx: (Math.random() - 0.5) * 1.15,
      vy: 0.55 + Math.random() * 1.15,
      vz: (Math.random() - 0.5) * 1.15,
      swirl: (Math.random() - 0.5) * 0.25,
    });
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("aSeed", new THREE.BufferAttribute(pSeed, 1));
  pGeo.setAttribute("aScale", new THREE.BufferAttribute(pScale, 1));

  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPhase2: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float aSeed;
      attribute float aScale;
      varying float vSeed;
      varying float vFlicker;
      uniform float uTime;
      uniform float uPixelRatio;
      void main() {
        vSeed = aSeed;
        vFlicker = 0.68 + 0.32 * sin(uTime * (4.0 + aSeed * 5.0) + aSeed * 40.0);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp((34.0 * aScale) / max(1.0, -mvPos.z), 1.8, 12.0) * uPixelRatio;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying float vSeed;
      varying float vFlicker;
      uniform float uPhase2;
      void main() {
        float dist = length(gl_PointCoord - 0.5);
        if (dist > 0.5) discard;
        float core = exp(-dist * dist * 24.0);
        float halo = smoothstep(0.5, 0.05, dist) * 0.45;
        float alpha = (core + halo) * vFlicker;

        vec3 ashCol = vec3(0.85, 0.72, 0.52);
        vec3 emberP1 = vec3(2.8, 1.05, 0.24);
        vec3 emberP2 = vec3(3.4, 0.16, 0.28);
        vec3 ember = mix(emberP1, emberP2, uPhase2);

        vec3 col = mix(ashCol, ember, step(0.32, vSeed));
        gl_FragColor = vec4(col, alpha * 0.85);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  group.add(particles);

  scene.add(group);

  let phase2Blend = 0;

  return {
    group,
    setPixelRatio(dpr) {
      pMat.uniforms.uPixelRatio.value = dpr;
    },
    setFogWallOpacity(val) {
      fogWallMat.uniforms.uOpacity.value = val;
      fogWallMesh.visible = val > 0.01;
    },
    update(dt, time, isPhase2) {
      const targetBlend = isPhase2 ? 1 : 0;
      phase2Blend += (targetBlend - phase2Blend) * Math.min(1, dt * 1.5);

      skyDome.mat.uniforms.uTime.value = time;
      skyDome.mat.uniforms.uPhase2.value = phase2Blend;
      flameMat.uniforms.uTime.value = time;
      flameMat.uniforms.uPhase2.value = phase2Blend;
      fogWallMat.uniforms.uTime.value = time;
      fogWallMat.uniforms.uPhase2.value = phase2Blend;
      graceFlameMat.uniforms.uTime.value = time;
      graceLight.intensity = 5.8 + Math.sin(time * 4.5) * 0.9;
      pMat.uniforms.uTime.value = time;
      pMat.uniforms.uPhase2.value = phase2Blend;

      crimsonLight.intensity = phase2Blend * (4.2 + Math.sin(time * 5.2) * 0.7);
      sunLight.color.setRGB(
        1.0,
        0.81 - phase2Blend * 0.44,
        0.55 - phase2Blend * 0.32
      );
      hemiLight.color.setRGB(
        0.95 - phase2Blend * 0.1,
        0.78 - phase2Blend * 0.46,
        0.54 - phase2Blend * 0.3
      );
      scene.fog.color.setRGB(
        0.12 + phase2Blend * 0.1,
        0.09 - phase2Blend * 0.055,
        0.075 - phase2Blend * 0.04
      );

      for (const bl of brazierLights) {
        const flicker = 0.82 + 0.18 * Math.sin(time * 9.3 + bl.phase) + 0.1 * Math.cos(time * 16.7 + bl.phase);
        bl.light.intensity = 5.4 * flicker;
        bl.light.color.setRGB(1.0, 0.56 - phase2Blend * 0.36, 0.2 + phase2Blend * 0.04);
      }

      // Orbit distant crumbling ruins slowly in the Farum Azula storm
      for (const r of floatingRuins) {
        r.ang += r.speed * dt;
        r.mesh.position.x = Math.cos(r.ang) * r.dist;
        r.mesh.position.z = Math.sin(r.ang) * r.dist;
        r.mesh.position.y = r.y + Math.sin(time * r.bobSpeed + r.dist) * 0.85;
        r.mesh.rotation.y += dt * 0.08;
      }

      // Drift ash & glowing embers upward with gentle storm spiral
      const posAttr = pGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let x = posAttr.getX(i) + (pVel[i].vx + Math.sin(time * 0.8 + i) * 0.35) * dt;
        let y = posAttr.getY(i) + pVel[i].vy * dt * (1.0 + phase2Blend * 0.95);
        let z = posAttr.getZ(i) + (pVel[i].vz + Math.cos(time * 0.7 + i) * 0.35) * dt;
        if (y > 18) {
          y = 0.15;
          const r = Math.sqrt(Math.random()) * (ARENA_RADIUS + 6);
          const a = Math.random() * Math.PI * 2;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
        }
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    },
  };
}
