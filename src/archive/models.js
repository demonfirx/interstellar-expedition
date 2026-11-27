import * as THREE from 'three';
import { createSailingVessel } from '../models/sailing-vessel.js';
import {
  createAccretionMaterial,
  createCosmicPlinthMaterial,
  createLensingHaloMaterial,
} from './visuals.js';

const TAU = Math.PI * 2;
const _cameraLocalDir = new THREE.Vector3();

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}

function arcSegment(inner, outer, angle, depth, bevel) {
  const start = -angle / 2;
  const end = angle / 2;
  const shape = new THREE.Shape();
  shape.moveTo(outer * Math.cos(start), outer * Math.sin(start));
  shape.absarc(0, 0, outer, start, end, false);
  shape.lineTo(inner * Math.cos(end), inner * Math.sin(end));
  shape.absarc(0, 0, inner, end, start, true);
  shape.closePath();
  const segment = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 24,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  segment.translate(0, 0, -depth / 2);
  return segment;
}

function createCeramicCore() {
  const uniforms = { uTime: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({
    color: '#9db8d6',
    roughness: 0.24,
    metalness: 0.42,
    envMapIntensity: 1.25,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = `
      varying vec3 vCore;
      varying vec3 vViewNorm;
      varying vec3 vViewPos;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vCore = normalize(position);
      vViewNorm = normalize(normalMatrix * normal);
      vViewPos = -(modelViewMatrix * vec4(position, 1.0)).xyz;`,
    );
    shader.fragmentShader = `
      varying vec3 vCore;
      varying vec3 vViewNorm;
      varying vec3 vViewPos;
      uniform float uTime;

      float coreTrace(vec3 p) {
        float angle = atan(p.z, p.x);
        float wave = sin(p.y * 15.0 + 2.4 * sin(angle * 3.0 + p.y * 8.0) + 1.1 * sin(angle * 7.0));
        float cracks = abs(wave + 0.17 * sin(angle * 21.0 + p.y * 38.0));
        return 1.0 - smoothstep(0.018, 0.165, cracks);
      }
      ${shader.fragmentShader}
    `
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 core = normalize(vCore);
        float trace = coreTrace(core);
        float shade = 0.5 + 0.5 * sin(core.y * 11.0 + 2.1 * sin(core.z * 8.0) + cos(core.x * 10.0));
        diffuseColor.rgb *= mix(vec3(0.10, 0.23, 0.39), vec3(0.56, 0.76, 0.95), shade);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float pulse = 0.78 + 0.22 * sin(uTime * 1.1 + vCore.y * 5.0);
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNorm), normalize(vViewPos))), 2.6);
        totalEmissiveRadiance += trace * vec3(0.10, 0.48, 0.78) * (0.28 + 0.65 * shade) * pulse;
        totalEmissiveRadiance += vec3(0.09, 0.24, 0.42) * fresnel * 0.55;`,
      );
  };
  return { material, uniforms };
}

function createTidalArray() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.name = 'Tidal_Array';
  root.add(body);
  body.rotation.set(0.27, -0.31, -0.3);

  const titanium = new THREE.MeshStandardMaterial({
    color: '#4c5968',
    metalness: 0.88,
    roughness: 0.27,
    envMapIntensity: 1.15,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#23313f',
    metalness: 0.7,
    roughness: 0.4,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: '#b2c3cc',
    metalness: 0.82,
    roughness: 0.23,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: '#cf9b68',
    metalness: 0.86,
    roughness: 0.23,
    envMapIntensity: 1.2,
  });
  const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.92, 0.26) });
  const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.24, 1.52, 3.35) });

  const rails = new THREE.TorusGeometry(2.07, 0.041, 12, 128);
  mesh(body, rails, steel, 0, 0, -0.18);
  mesh(body, rails, bronze, 0, 0, 0.18);
  mesh(body, new THREE.TorusGeometry(1.86, 0.057, 14, 128), titanium);

  const housing = arcSegment(2.1, 2.36, 0.89, 0.25, 0.031);
  const panel = arcSegment(2.18, 2.34, 0.62, 0.048, 0.012);
  const recess = arcSegment(2.1, 2.28, 0.51, 0.025, 0.008);
  const amberStrip = arcSegment(2.225, 2.254, 0.43, 0.012, 0.003);
  const bridge = arcSegment(1.84, 2.15, 0.11, 0.3, 0.025);

  for (let i = 0; i < 6; i++) {
    const angle = (i * TAU) / 6;
    mesh(body, housing, i % 3 === 1 ? dark : titanium).rotation.z = angle;
    mesh(body, panel, i % 3 === 1 ? steel : bronze, 0, 0, 0.185).rotation.z = angle;
    mesh(body, recess, dark, 0, 0, 0.222).rotation.z = angle;
    mesh(body, amberStrip, amber, 0, 0, 0.242).rotation.z = angle;
    mesh(body, bridge, steel).rotation.z = angle + 0.25;
  }

  const tickGeometry = new THREE.BoxGeometry(0.047, 0.012, 0.013);
  const ticks = new THREE.InstancedMesh(tickGeometry, steel, 144);
  const stamp = new THREE.Object3D();
  for (let i = 0; i < ticks.count; i++) {
    const angle = (i * TAU) / ticks.count;
    stamp.position.set(1.972 * Math.cos(angle), 1.972 * Math.sin(angle), 0.186);
    stamp.rotation.z = angle;
    stamp.scale.set(i % 12 === 0 ? 2.1 : 1, 1, 1);
    stamp.updateMatrix();
    ticks.setMatrixAt(i, stamp.matrix);
  }
  body.add(ticks);

  const boltGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.022, 6);
  boltGeometry.rotateX(Math.PI / 2);
  const bolts = new THREE.InstancedMesh(boltGeometry, steel, 24);
  for (let i = 0; i < bolts.count; i++) {
    const angle = (Math.floor(i / 4) * TAU) / 6 + (i % 4 < 2 ? -0.342 : 0.342);
    const radius = i % 2 === 0 ? 2.18 : 2.3;
    stamp.position.set(radius * Math.cos(angle), radius * Math.sin(angle), 0.169);
    stamp.rotation.z = angle;
    stamp.scale.setScalar(1);
    stamp.updateMatrix();
    bolts.setMatrixAt(i, stamp.matrix);
  }
  body.add(bolts);

  const hinge = new THREE.Group();
  hinge.rotation.z = 0.3;
  body.add(hinge);
  const pin = new THREE.CylinderGeometry(0.066, 0.066, 0.54, 18);
  const socket = new THREE.CylinderGeometry(0.11, 0.11, 0.18, 18);
  for (const sign of [-1, 1]) {
    mesh(hinge, pin, steel, 0, sign * 1.81);
    mesh(hinge, socket, titanium, 0, sign * 2.01);
  }

  const gimbal = new THREE.Group();
  gimbal.rotation.y = 0.42;
  hinge.add(gimbal);
  mesh(gimbal, new THREE.TorusGeometry(1.54, 0.074, 14, 112), bronze);
  mesh(gimbal, new THREE.TorusGeometry(1.42, 0.023, 10, 104), steel, 0, 0, 0.06);
  const bearing = new THREE.SphereGeometry(0.108, 18, 14);
  for (let i = 0; i < 4; i++) {
    const angle = (i * TAU) / 4 + 0.4;
    mesh(gimbal, arcSegment(1.38, 1.68, 0.21, 0.17, 0.02), titanium).rotation.z = angle;
    mesh(gimbal, bearing, steel, 1.53 * Math.cos(angle), 1.53 * Math.sin(angle), 0.11);
  }

  const cradle = new THREE.Group();
  cradle.rotation.set(-0.54, -0.58, 0.2);
  body.add(cradle);
  mesh(cradle, new THREE.TorusGeometry(1.13, 0.037, 14, 100), steel);
  mesh(cradle, new THREE.TorusGeometry(1.065, 0.013, 10, 100), blue, 0, 0, 0.033);
  const spurs = arcSegment(1.01, 1.23, 0.31, 0.116, 0.014);
  for (let i = 0; i < 3; i++) mesh(cradle, spurs, dark).rotation.z = (i * TAU) / 3;

  const ceramic = createCeramicCore();
  const core = mesh(body, new THREE.SphereGeometry(0.79, 48, 32), ceramic.material);
  const collar = mesh(body, new THREE.TorusGeometry(0.815, 0.015, 10, 96), bronze);
  collar.rotation.set(0.86, 0.46, -0.2);

  // Subtle exterior astronomical calibration meridian ring (excluded from hologram)
  const calibration = new THREE.Group();
  calibration.rotation.set(0.14, 0.22, -0.18);
  body.add(calibration);
  const wireMat = new THREE.MeshBasicMaterial({
    color: '#c8a684',
    transparent: true,
    opacity: 0.22,
  });
  const wireRing = mesh(calibration, new THREE.TorusGeometry(2.68, 0.0055, 8, 144), wireMat);
  wireRing.userData.skipHologram = true;
  const nodeGeo = new THREE.OctahedronGeometry(0.032, 0);
  const nodeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 1.15, 0.85) });
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4;
    const beacon = mesh(calibration, nodeGeo, nodeMat, 2.68 * Math.cos(a), 2.68 * Math.sin(a), 0);
    beacon.userData.skipHologram = true;
  }

  return {
    root,
    baseYaw: 0.06,
    mood: {
      skyCool: '#12263b',
      skyWarm: '#2f190c',
      keyWarm: '#ffad6a',
      keyCool: '#78bfff',
      dustWarm: '#ffc58f',
      dustCool: '#a4ceff',
      bloomStrength: 0.48,
    },
    update(time) {
      ceramic.uniforms.uTime.value = time;
      core.rotation.y = time * 0.21;
      gimbal.rotation.y = 0.42 + Math.sin(time * 0.42) * 0.18;
      cradle.rotation.x = -0.54 + Math.sin(time * 0.61) * 0.22;
      calibration.rotation.z = -0.18 - time * 0.055;
    },
  };
}

function createArchiveSailer() {
  const vessel = createSailingVessel();
  const root = new THREE.Group();
  const swayGroup = new THREE.Group();
  root.name = 'Lumen_Sailer';
  root.add(swayGroup);

  vessel.root.scale.setScalar(0.95);
  vessel.root.position.set(0, -1.06, 0);
  swayGroup.add(vessel.root);

  // Enhance cabin glass & lanterns for gallery depth
  const cabinGlass = vessel.materials.find((m) => m.name === 'Cabin_Glass');
  if (cabinGlass) {
    cabinGlass.emissive.set('#6d8fd1');
    cabinGlass.emissiveIntensity = 0.34;
    cabinGlass.envMapIntensity = 1.55;
  }

  // Upgrade sails with fine linen weave + backlit translucent horizon glow
  for (const sail of vessel.sails) {
    const material = sail.mesh.material;
    material.color.set('#e7dfd0');
    material.roughness = 0.84;
    material.metalness = 0.04;
    material.envMapIntensity = 0.78;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        varying vec2 vWeave;
        varying vec3 vSailViewNorm;
        varying vec3 vSailViewDir;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWeave = uv;
        vSailViewNorm = normalize(normalMatrix * normal);
        vSailViewDir = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);`,
      );
      shader.fragmentShader = `
        varying vec2 vWeave;
        varying vec3 vSailViewNorm;
        varying vec3 vSailViewDir;
        ${shader.fragmentShader}
      `
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float seam = smoothstep(0.024, 0.088, abs(fract(vWeave.y * 7.0) - 0.5));
          float hem = smoothstep(0.0, 0.026, min(vWeave.x, 1.0 - vWeave.x));
          float weave = 0.96 + 0.04 * sin(vWeave.x * 160.0) * sin(vWeave.y * 160.0);
          diffuseColor.rgb *= mix(0.60, 0.91 + 0.09 * seam, hem) * weave;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float rim = pow(1.0 - abs(dot(normalize(vSailViewNorm), normalize(vSailViewDir))), 2.2);
          float topGlow = smoothstep(0.15, 0.95, vWeave.y);
          totalEmissiveRadiance += mix(vec3(0.06, 0.11, 0.18), vec3(0.20, 0.14, 0.08), topGlow) * (0.12 + rim * 0.42);`,
        );
    };
  }

  // Soft feathered radial lantern halos (excluded from hologram sampling)
  function createLanternHalo(hexColor, size) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(hexColor) } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float core = exp(-d * d * 12.0) * 0.9;
          float aura = exp(-d * d * 3.2) * 0.42;
          float cut = 1.0 - smoothstep(0.75, 1.0, d);
          gl_FragColor = vec4(uColor * (core + aura), (core + aura) * cut);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    plane.userData.skipHologram = true;
    return plane;
  }

  const bowGlow = createLanternHalo('#7ed6ff', 0.42);
  bowGlow.position.set(1.47, 0.37, 0.28);
  vessel.root.add(bowGlow);

  const sternGlow = createLanternHalo('#ffbe78', 0.38);
  sternGlow.position.set(-1.35, 0.76, 0.27);
  vessel.root.add(sternGlow);

  // Floating translucent cosmic tidal ripple plane beneath the waterline
  const plinthMaterial = createCosmicPlinthMaterial();
  const plinth = mesh(root, new THREE.PlaneGeometry(5.1, 4.3, 1, 1), plinthMaterial, 0, -1.27, 0);
  plinth.rotation.x = -Math.PI / 2;
  plinth.userData.skipHologram = true;

  return {
    root,
    baseYaw: -0.44,
    mood: {
      skyCool: '#122a44',
      skyWarm: '#241b16',
      keyWarm: '#f0bc88',
      keyCool: '#84c5ff',
      dustWarm: '#e9c8a0',
      dustCool: '#9acbff',
      bloomStrength: 0.42,
    },
    update(time, camera) {
      vessel.updateSails(time, 0.82);
      plinthMaterial.uniforms.uTime.value = time;
      swayGroup.position.y = Math.sin(time * 0.85) * 0.045;
      swayGroup.rotation.z = Math.sin(time * 0.72 + 0.4) * 0.022;
      swayGroup.rotation.x = Math.cos(time * 0.63) * 0.016;
      if (camera) {
        vessel.root.worldToLocal(_cameraLocalDir.copy(camera.position));
        bowGlow.lookAt(_cameraLocalDir);
        sternGlow.lookAt(_cameraLocalDir);
      }
    },
  };
}

function createEventHorizon() {
  const root = new THREE.Group();
  root.name = 'Event_Horizon';

  const diskMaterial = createAccretionMaterial();
  const tilt = new THREE.Group();
  // Negative X tilt brings the lower-front equatorial band across the front of
  // the shadow while hiding the rear half behind the event horizon dome.
  tilt.rotation.set(-1.36, 0, -0.22);
  root.add(tilt);

  // Singularity event horizon shadow core
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: '#000103' });
  mesh(root, new THREE.SphereGeometry(0.925, 56, 36), sphereMaterial);

  // Primary relativistic equatorial accretion disk
  const mainDisk = mesh(tilt, new THREE.RingGeometry(0.95, 3.05, 160, 12), diskMaterial);
  mainDisk.renderOrder = 2;

  // Thin secondary plasma thickness layer for rich volume at shallow angles
  const upperSheath = mesh(tilt, new THREE.RingGeometry(0.97, 2.62, 128, 8), diskMaterial, 0, 0, 0.028);
  upperSheath.rotation.x = 0.022;
  upperSheath.userData.skipHologram = true;
  upperSheath.renderOrder = 2;

  // View-aligned gravitationally lensed upper/lower light arches & Einstein ring
  const lensMaterial = createLensingHaloMaterial();
  const lensPlane = mesh(root, new THREE.PlaneGeometry(5.2, 5.2, 1, 1), lensMaterial);
  lensPlane.userData.skipHologram = true;
  lensPlane.renderOrder = 1;

  // Subtle 3D orbiting relativistic dust embers in the equatorial plane
  const emberCount = 220;
  const emberPos = new Float32Array(emberCount * 3);
  const emberSeeds = new Float32Array(emberCount);
  let s = 4211;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < emberCount; i++) {
    const r = 1.12 + Math.pow(rand(), 1.35) * 2.05;
    const a = rand() * TAU;
    const z = (rand() - 0.5) * 0.16 * (r / 2.2);
    emberPos[i * 3] = r * Math.cos(a);
    emberPos[i * 3 + 1] = r * Math.sin(a);
    emberPos[i * 3 + 2] = z;
    emberSeeds[i] = rand();
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(emberSeeds, 1));
  const emberMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSeed;
      varying float vSeed;
      uniform float uTime;
      void main() {
        vSeed = aSeed;
        float r = length(position.xy);
        float a = atan(position.y, position.x) - uTime * (0.24 / max(pow(r, 1.25), 0.8));
        vec3 p = vec3(r * cos(a), r * sin(a), position.z + sin(uTime * 0.9 + aSeed * 15.0) * 0.02);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((10.0 + aSeed * 11.0) / max(-mv.z, 1.0), 1.0, 3.2);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vSeed;
      void main() {
        float g = 1.0 - smoothstep(0.05, 0.5, length(gl_PointCoord - 0.5));
        vec3 col = mix(vec3(0.62, 0.78, 1.3), vec3(1.45, 0.85, 0.42), smoothstep(0.2, 0.85, vSeed));
        gl_FragColor = vec4(col, g * (0.28 + 0.46 * vSeed));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.userData.skipHologram = true;
  tilt.add(embers);

  return {
    root,
    baseYaw: -0.06,
    mood: {
      skyCool: '#141c3c',
      skyWarm: '#34160a',
      keyWarm: '#ff9d54',
      keyCool: '#7b92ff',
      dustWarm: '#ffb36c',
      dustCool: '#98aaff',
      bloomStrength: 0.58,
    },
    update(time, camera) {
      diskMaterial.uniforms.uTime.value = time;
      lensMaterial.uniforms.uTime.value = time;
      emberMat.uniforms.uTime.value = time;
      if (camera) {
        // Keep gravitational lensing plane oriented smoothly toward camera in local space
        root.worldToLocal(_cameraLocalDir.copy(camera.position));
        lensPlane.lookAt(_cameraLocalDir);
      }
    },
  };
}

export const createArchiveModels = [createTidalArray, createArchiveSailer, createEventHorizon];
