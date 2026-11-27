import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createArenaFloorTextures, createFarumEnvironment } from '../elden/materials.js';
import { loadMaerithShowcase } from '../elden/models.js';
import { createBladeTrail } from '../elden/vfx.js';

const _tmpBase = new THREE.Vector3();
const _tmpTip = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function createFarumShowcaseSky() {
  const geo = new THREE.SphereGeometry(90, 42, 28);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPhase2: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
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
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = mat2(1.6, 1.2, -1.2, 1.6) * p;
          a *= 0.48;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float elev = d.y;
        float ca = cos(uTime * 0.035);
        float sa = sin(uTime * 0.035);
        vec3 rd = vec3(d.x * ca - d.z * sa, d.y, d.x * sa + d.z * ca);

        float swirl = fbm(rd.xz * 2.5 + vec2(rd.y * 2.0, -uTime * 0.025));
        float detail = fbm(vec2(rd.x * 2.1 - rd.z * 2.1, rd.y * 3.5) + swirl * 1.4);

        vec3 zenith = mix(vec3(0.03, 0.024, 0.028), vec3(0.045, 0.008, 0.014), uPhase2);
        vec3 mid = mix(vec3(0.11, 0.08, 0.062), vec3(0.18, 0.024, 0.034), uPhase2);
        vec3 horizon = mix(vec3(0.32, 0.19, 0.095), vec3(0.46, 0.055, 0.075), uPhase2);

        float hBand = exp(-abs(elev + 0.02) * 5.6);
        vec3 col = mix(mid, zenith, smoothstep(0.04, 0.65, elev));
        col = mix(col, horizon, hBand * 0.72);
        col = mix(col, vec3(0.022, 0.016, 0.016), smoothstep(-0.04, -0.42, elev) * 0.92);

        vec3 cloudLit = mix(vec3(0.72, 0.47, 0.22), vec3(0.95, 0.14, 0.19), uPhase2);
        float cMask = smoothstep(0.36, 0.84, swirl * 0.65 + detail * 0.35) * smoothstep(-0.2, 0.16, elev);
        col = mix(col, col * 0.45 + cloudLit * (0.20 + hBand * 0.34), cMask * 0.78);

        // Distant storm eclipse light behind Maerith
        vec3 sunDir = normalize(vec3(0.25, 0.28, -0.92));
        float sunDot = max(0.0, dot(d, sunDir));
        vec3 sunCol = mix(vec3(0.86, 0.54, 0.24), vec3(1.18, 0.16, 0.20), uPhase2);
        col += sunCol * (pow(sunDot, 14.0) * 0.25 + pow(sunDot, 95.0) * 0.42);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -50;
  return { mesh, mat, geo };
}

function createEmberField(count = 140) {
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let s = 31337;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const r = 1.4 + rand() * 5.8;
    const a = rand() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = rand() * 6.5;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seeds[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPhase2: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: `
      attribute float aSeed;
      varying float vSeed;
      varying float vAlpha;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vSeed = aSeed;
        vec3 p = position;
        float cycle = fract(p.y / 6.5 + uTime * (0.045 + aSeed * 0.055));
        p.y = cycle * 6.5 - 0.1;
        float swirl = uTime * (0.12 + aSeed * 0.18) + aSeed * 12.0;
        p.x += cos(swirl) * 0.24;
        p.z += sin(swirl) * 0.24;
        vAlpha = smoothstep(0.0, 0.15, cycle) * (1.0 - smoothstep(0.75, 1.0, cycle));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((14.0 + aSeed * 14.0) / max(-mv.z, 1.0), 1.4, 4.4) * uPixelRatio;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vSeed;
      varying float vAlpha;
      uniform float uPhase2;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float glow = 1.0 - smoothstep(0.05, 0.5, d);
        vec3 p1 = mix(vec3(1.1, 0.72, 0.3), vec3(1.4, 0.96, 0.58), vSeed);
        vec3 p2 = mix(vec3(1.6, 0.14, 0.22), vec3(1.8, 0.58, 0.34), vSeed);
        vec3 col = mix(p1, p2, uPhase2);
        gl_FragColor = vec4(col, glow * vAlpha * (0.35 + 0.55 * vSeed));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat, geo };
}

function createPhaseShockwave() {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 1 },
      uColor: { value: new THREE.Color('#ff2030') },
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
      uniform float uProgress;
      uniform vec3 uColor;
      void main() {
        if (uProgress >= 0.999) discard;
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float band = exp(-pow((r - 0.78) * 14.0, 2.0));
        float fade = pow(1.0 - uProgress, 1.45);
        if (r > 1.0) discard;
        gl_FragColor = vec4(uColor * (2.6 + band * 1.8), band * fade * 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  mesh.visible = false;
  return { mesh, mat, geo };
}

export function createMaerithStage(canvas, orbitSurface, { onProgress, onReady, onTelemetry }) {
  // Start fetching binary GLBs immediately so network I/O overlaps WebGL setup
  const modelPromise = loadMaerithShowcase((pct, label) => {
    onProgress?.(pct, label);
  });

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x110c0b, 0.022);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.15, 160);

  let envRT;
  try {
    envRT = createFarumEnvironment(renderer);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.08;
  } catch (err) {
    console.warn('Farum IBL fallback:', err);
  }
  const sky = createFarumShowcaseSky();
  scene.add(sky.mesh);

  const hemi = new THREE.HemisphereLight(0xf3c68a, 0x241819, 0.96);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffcf8d, 2.95);
  keyLight.position.set(6.5, 10.5, 7.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 28;
  keyLight.shadow.camera.left = -5.5;
  keyLight.shadow.camera.right = 5.5;
  keyLight.shadow.camera.top = 5.5;
  keyLight.shadow.camera.bottom = -5.5;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.03;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x88a4cc, 1.55);
  rimLight.position.set(-7.5, 6.0, -6.5);
  scene.add(rimLight);

  const crimsonBack = new THREE.PointLight(0xff1e2d, 2.2, 20, 1.35);
  crimsonBack.position.set(-1.6, 2.9, -2.8);
  scene.add(crimsonBack);

  // Carved circular Farum Azula stone dais + gilded rune ring
  const floorTex = createArenaFloorTextures();
  const daisMat = new THREE.MeshStandardMaterial({
    map: floorTex.map,
    normalMap: floorTex.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: floorTex.roughnessMap,
    metalnessMap: floorTex.metalnessMap,
    roughness: 0.9,
    metalness: 0.85,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x26201d,
    roughness: 0.92,
    metalness: 0.14,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a050,
    roughness: 0.25,
    metalness: 0.94,
    envMapIntensity: 1.25,
  });

  const daisGroup = new THREE.Group();
  const topSlab = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.85, 0.42, 64), daisMat);
  topSlab.position.y = -0.21;
  topSlab.receiveShadow = true;
  daisGroup.add(topSlab);

  const lowerPlinth = new THREE.Mesh(new THREE.CylinderGeometry(3.75, 2.85, 1.4, 48), darkStoneMat);
  lowerPlinth.position.y = -1.12;
  daisGroup.add(lowerPlinth);

  const outerGoldRing = new THREE.Mesh(new THREE.TorusGeometry(3.48, 0.055, 10, 72), goldMat);
  outerGoldRing.rotation.x = Math.PI / 2;
  outerGoldRing.position.y = 0.02;
  daisGroup.add(outerGoldRing);

  const innerGoldRing = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.026, 8, 64), goldMat);
  innerGoldRing.rotation.x = Math.PI / 2;
  innerGoldRing.position.y = 0.015;
  daisGroup.add(innerGoldRing);

  scene.add(daisGroup);

  const embers = createEmberField(140);
  scene.add(embers.points);

  const shockwave = createPhaseShockwave();
  scene.add(shockwave.mesh);

  const bladeTrail = createBladeTrail(scene, {
    color: 0xff1e2d,
    coreColor: 0xffb36b,
    maxSamples: 16,
    crimsonDark: true,
  });

  let composer;
  let bloom;
  let output;
  let postReady = false;
  function initPostEffects() {
    if (postReady || disposed) return;
    postReady = true;
    if (renderer.extensions.has('EXT_color_buffer_float')) {
      try {
        const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
        composer = new EffectComposer(renderer, rt);
        bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.46, 0.42, 0.92);
        output = new OutputPass();
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(bloom);
        composer.addPass(output);
      } catch {
        try {
          const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
          composer = new EffectComposer(renderer, rt);
          bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.46, 0.42, 0.92);
          output = new OutputPass();
          composer.addPass(new RenderPass(scene, camera));
          composer.addPass(bloom);
          composer.addPass(output);
        } catch {
          composer = bloom = output = undefined;
        }
      }
      if (composer) {
        bloomEnabled = true;
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(viewWidth, viewHeight);
      }
    }
  }

  let maerith = null;
  let firstFramePainted = false;
  let modelPainted = false;
  let disposed = false;
  let paused = false;
  let reduced = false;
  let phase2 = false;
  let phaseBlend = 0;
  let shockAge = 1;
  let targetYaw = 0.34;
  let currentYaw = 0.34;
  let targetPitch = 0.14;
  let currentPitch = 0.14;
  let targetZoom = 1;
  let currentZoom = 1;
  let pointerX = 0;
  let pointerY = 0;
  let smoothPointerX = 0;
  let smoothPointerY = 0;
  let viewWidth = 1;
  let viewHeight = 1;
  let focusX = 0.65;
  let focusY = 0.5;
  let baseDistance = 8.4;
  let elapsed = 0;
  let lastNow = 0;
  let rafId = 0;
  let bloomEnabled = Boolean(composer);
  let lastTeleKey = '';
  let pendingStance = 'idle';

  function triggerPulse(crimson) {
    shockAge = 0;
    shockwave.mat.uniforms.uColor.value.set(crimson ? '#ff2030' : '#f0b858');
    shockwave.mesh.visible = true;
  }

  function resize() {
    if (disposed) return;
    const frame = canvas.getBoundingClientRect();
    const box = orbitSurface.getBoundingClientRect();
    viewWidth = Math.max(1, Math.round(frame.width));
    viewHeight = Math.max(1, Math.round(frame.height));
    focusX = box.left - frame.left + box.width * 0.5;
    const isMobile = viewWidth <= 760;
    focusY = box.top - frame.top + box.height * (isMobile ? 0.58 : 0.54);
    baseDistance = isMobile ? 12.2 : 8.45;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    camera.aspect = viewWidth / viewHeight;
    camera.setViewOffset(
      viewWidth,
      viewHeight,
      viewWidth * 0.5 - focusX,
      viewHeight * 0.5 - focusY,
      viewWidth,
      viewHeight,
    );
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(dpr);
    renderer.setSize(viewWidth, viewHeight, false);
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(viewWidth, viewHeight);
    }
    embers.mat.uniforms.uPixelRatio.value = dpr;
  }

  function emitTelemetry() {
    if (!onTelemetry) return;
    const yawDeg = Math.round(THREE.MathUtils.radToDeg(currentYaw - 0.34)) % 360;
    const pitchDeg = Math.round(THREE.MathUtils.radToDeg(currentPitch));
    const zStr = currentZoom.toFixed(2);
    const key = `${yawDeg}:${pitchDeg}:${zStr}`;
    if (key !== lastTeleKey) {
      lastTeleKey = key;
      onTelemetry({ yaw: yawDeg, pitch: pitchDeg, zoom: currentZoom });
    }
  }

  let slowFrames = 0;

  function handleVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!disposed && !rafId) {
      lastNow = 0;
      rafId = requestAnimationFrame(draw);
    }
  }
  document.addEventListener('visibilitychange', handleVisibility);

  function draw(now) {
    if (disposed || document.hidden) {
      rafId = 0;
      return;
    }
    rafId = requestAnimationFrame(draw);
    const rawDt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, 0.08);
    lastNow = now;

    if (modelPainted && rawDt > 0.048) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames >= 10 && bloomEnabled) {
      bloomEnabled = false;
      slowFrames = 0;
    }

    if (!paused && !reduced) elapsed += dt;

    const smooth = reduced ? 1 : 1 - Math.exp(-dt * 7.5);
    phaseBlend = THREE.MathUtils.lerp(phaseBlend, phase2 ? 1 : 0, reduced ? 1 : Math.min(1, dt * 4.2));
    smoothPointerX = THREE.MathUtils.lerp(smoothPointerX, reduced ? 0 : pointerX, smooth * 0.7);
    smoothPointerY = THREE.MathUtils.lerp(smoothPointerY, reduced ? 0 : pointerY, smooth * 0.7);

    currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw + smoothPointerX * 0.09, smooth);
    currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch + smoothPointerY * 0.06, smooth);
    currentZoom = THREE.MathUtils.lerp(currentZoom, targetZoom, smooth);

    const dist = baseDistance / currentZoom;
    const horiz = Math.cos(currentPitch) * dist;
    const vert = Math.sin(currentPitch) * dist;
    _camPos.set(Math.sin(currentYaw) * horiz, 2.02 + vert, Math.cos(currentYaw) * horiz);
    _camLook.set(0, 1.98, 0);
    camera.position.copy(_camPos);
    camera.lookAt(_camLook);

    // Update sky, lighting & embers to Phase I / Phase II
    sky.mat.uniforms.uTime.value = elapsed;
    sky.mat.uniforms.uPhase2.value = phaseBlend;
    embers.mat.uniforms.uTime.value = elapsed;
    embers.mat.uniforms.uPhase2.value = phaseBlend;
    crimsonBack.intensity = 2.2 + phaseBlend * 4.8 + Math.sin(elapsed * 5.0) * 0.35 * phaseBlend;
    keyLight.color.setRGB(
      THREE.MathUtils.lerp(1.0, 0.98, phaseBlend),
      THREE.MathUtils.lerp(0.81, 0.48, phaseBlend),
      THREE.MathUtils.lerp(0.55, 0.38, phaseBlend),
    );
    if (bloom) bloom.strength = 0.34 + phaseBlend * 0.14;

    if (shockAge < 1) {
      shockAge = Math.min(1, shockAge + dt * 1.45);
      const ease = 1 - (1 - shockAge) ** 2.2;
      const scale = 0.8 + ease * 4.4;
      shockwave.mesh.scale.set(scale, scale, 1);
      shockwave.mat.uniforms.uProgress.value = shockAge;
      if (shockAge >= 1) shockwave.mesh.visible = false;
    }

    if (maerith) {
      maerith.update(dt, elapsed, phase2, paused || reduced);
      maerith.root.updateMatrixWorld(true);
      maerith.bladeBase.getWorldPosition(_tmpBase);
      maerith.bladeTip.getWorldPosition(_tmpTip);
      bladeTrail.update(!paused && !reduced && maerith.isBladeTrailActive(), _tmpBase, _tmpTip, dt);
    }

    if (bloomEnabled && composer) {
      try {
        composer.render(dt);
      } catch {
        bloomEnabled = false;
        renderer.render(scene, camera);
      }
    } else {
      renderer.render(scene, camera);
    }

    if (!firstFramePainted) {
      firstFramePainted = true;
      setTimeout(initPostEffects, 0);
    }
    if (maerith && !modelPainted) {
      modelPainted = true;
      onReady?.();
    }

    emitTelemetry();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  observer.observe(orbitSurface);
  resize();
  rafId = requestAnimationFrame(draw);

  // Attach pre-fetched sculpted 3D Maerith rig onto the live Farum Azula dais
  modelPromise
    .then((model) => {
      if (disposed) return;
      maerith = model;
      scene.add(maerith.root);
      maerith.setStance(pendingStance);
      triggerPulse(phase2);
    })
    .catch((err) => {
      console.error('Gagal memuat model 3D Maerith:', err);
      onProgress?.(0, 'Gagal memuat model 3D');
    });

  return {
    orbit(dx, dy) {
      targetYaw -= dx * 0.0085;
      targetPitch = THREE.MathUtils.clamp(targetPitch + dy * 0.006, -0.18, 0.68);
    },
    zoom(delta) {
      targetZoom = THREE.MathUtils.clamp(targetZoom * (1 - delta * 0.0009), 0.72, 1.55);
    },
    reset() {
      targetYaw = 0.34;
      targetPitch = 0.14;
      targetZoom = 1;
    },
    setPhase(isPhase2) {
      if (phase2 === isPhase2) return;
      phase2 = isPhase2;
      triggerPulse(isPhase2);
    },
    setStance(stance) {
      pendingStance = stance;
      maerith?.setStance(stance);
      if (stance === 'slam' || stance === 'ascend') triggerPulse(phase2);
    },
    setPointer(nx, ny) {
      pointerX = THREE.MathUtils.clamp(nx, -1, 1);
      pointerY = THREE.MathUtils.clamp(ny, -1, 1);
    },
    setMotion({ freeze, reduce }) {
      paused = freeze;
      reduced = reduce;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibility);
      observer.disconnect();
      sky.geo.dispose();
      sky.mat.dispose();
      embers.geo.dispose();
      embers.mat.dispose();
      shockwave.geo.dispose();
      shockwave.mat.dispose();
      floorTex.map.dispose();
      floorTex.normalMap.dispose();
      floorTex.roughnessMap.dispose();
      floorTex.metalnessMap.dispose();
      envRT?.dispose();
      bloom?.dispose();
      output?.dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };
}
