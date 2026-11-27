import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createArchiveModels } from './models.js';
import { sampleSurface } from './surface.js';
import { createArchiveSky, createHologram, createStarDust } from './visuals.js';

const POINT_COUNT = 5200;
const TRANSITION_DURATION = 0.92;
const easeOut = (t) => 1 - (1 - t) ** 3;

const _targetSkyCool = new THREE.Color();
const _targetSkyWarm = new THREE.Color();
const _targetKeyWarm = new THREE.Color();
const _targetKeyCool = new THREE.Color();
const _targetDustWarm = new THREE.Color();
const _targetDustCool = new THREE.Color();

/**
 * Custom architectural observatory IBL scene: replaces generic white studio
 * panels with sculpted copper-gold and cerulean light arcs for crisp speculars.
 */
function buildObservatoryEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#070b13');

  const panelGeo = new THREE.PlaneGeometry(1, 1);
  const addSoftbox = (color, intensity, pos, rot, scale) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(panelGeo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.scale.set(...scale);
    studio.add(m);
    return mat;
  };

  const mats = [
    addSoftbox('#ffbd82', 4.2, [8, 4, 2], [0, -Math.PI / 2, 0], [8, 12, 1]),
    addSoftbox('#7bc2ff', 3.6, [-8, 3, -3], [0, Math.PI / 2, 0], [9, 10, 1]),
    addSoftbox('#dceeff', 2.6, [0, 9, 4], [Math.PI / 2, 0, 0], [14, 7, 1]),
    addSoftbox('#24385c', 1.4, [0, -8, 0], [-Math.PI / 2, 0, 0], [16, 16, 1]),
    addSoftbox('#ffd7b0', 2.2, [2, 2, 9], [0, Math.PI, 0], [6, 4, 1]),
  ];

  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    return pmrem.fromScene(studio, 0.032, 0.1, 100);
  } finally {
    panelGeo.dispose();
    for (const m of mats) m.dispose();
    pmrem.dispose();
  }
}

export function createArchiveScene(canvas, stage, onRendered, onTelemetry) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.12, 90);
  const sky = createArchiveSky(renderer);
  scene.add(sky.sky);

  const hemi = new THREE.HemisphereLight('#bedeff', '#465678', 1.04);
  scene.add(hemi);

  const keyFront = new THREE.DirectionalLight('#e4f0ff', 2.95);
  keyFront.position.set(-4, 4.2, 3.2);
  scene.add(keyFront);

  const rimCool = new THREE.DirectionalLight('#78bfff', 2.85);
  rimCool.position.set(-3.4, -0.8, -4.2);
  scene.add(rimCool);

  const rimWarm = new THREE.DirectionalLight('#ffad6a', 3.65);
  rimWarm.position.set(5.2, 2.2, -1.2);
  scene.add(rimWarm);

  let environment;
  function lightEnvironment() {
    environment?.dispose();
    environment = undefined;
    try {
      environment = buildObservatoryEnvironment(renderer);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.86;
      scene.environmentRotation.y = -0.35;
    } catch (err) {
      console.warn('Observatory IBL fallback active:', err);
    }
  }
  // Set IBL before Frame 1 so MeshStandardMaterials compile once with USE_ENVMAP (zero Frame-2 recompile)
  lightEnvironment();

  const orbit = new THREE.Group();
  scene.add(orbit);

  // Lazy-build specimens 1 & 2 after Frame 1 so initial 3D startup is instantaneous
  const specimens = createArchiveModels.map(() => null);
  function getSpecimen(i) {
    if (!specimens[i]) {
      const model = createArchiveModels[i]();
      orbit.add(model.root);
      model.root.visible = false;
      specimens[i] = model;
    }
    return specimens[i];
  }
  getSpecimen(0);

  const hologram = createHologram(POINT_COUNT);
  orbit.add(hologram.points);

  const dust = createStarDust(160);
  scene.add(dust.points);

  let composer;
  let bloom;
  let output;
  let postReady = false;
  function initPostEffects() {
    if (postReady || disposed || lost) return;
    postReady = true;
    if (renderer.extensions.has('EXT_color_buffer_float')) {
      try {
        const target = new THREE.WebGLRenderTarget(1, 1, {
          type: THREE.HalfFloatType,
          samples: 2,
        });
        composer = new EffectComposer(renderer, target);
        bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.42, 0.92);
        output = new OutputPass();
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(bloom);
        composer.addPass(output);
      } catch {
        try {
          const fallbackTarget = new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.HalfFloatType,
          });
          composer = new EffectComposer(renderer, fallbackTarget);
          bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.42, 0.92);
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

  let animationFrame = 0;
  let lastFrame = 0;
  let ready = false;
  let lost = false;
  let disposed = false;
  let paused = false;
  let reduced = false;
  let exploring = false;
  let index = 0;
  let fromIndex = 0;
  let progress = 1;
  let idleTime = 0;
  let intro = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let targetZoom = 1;
  let currentZoom = 1;
  let pointerX = 0;
  let pointerY = 0;
  let smoothPointerX = 0;
  let smoothPointerY = 0;
  let distance = 11;
  let viewWidth = 1;
  let viewHeight = 1;
  let stageFocusX = 0.5;
  let stageFocusY = 0.5;
  let resolutionLimit = 1.75;
  let bloomEnabled = Boolean(composer);
  let slowFrames = 0;
  let skyLayout = '';
  let lastTelemetryKey = '';

  function applyMoodInstant(specimen) {
    const m = specimen.mood;
    sky.uniforms.uCoolColor.value.set(m.skyCool);
    sky.uniforms.uWarmColor.value.set(m.skyWarm);
    rimWarm.color.set(m.keyWarm);
    rimCool.color.set(m.keyCool);
    dust.uniforms.uWarmTint.value.set(m.dustWarm);
    dust.uniforms.uTint.value.set(m.dustCool);
    if (bloom) bloom.strength = m.bloomStrength;
  }
  applyMoodInstant(getSpecimen(0));

  function updateCameraOffset() {
    const isDesktop = viewWidth > 760;
    const centerX = viewWidth * 0.5;
    const centerY = viewHeight * (isDesktop ? 0.475 : 0.49);
    const fx = THREE.MathUtils.lerp(stageFocusX, isDesktop ? centerX : stageFocusX, intro);
    const fy = THREE.MathUtils.lerp(stageFocusY, isDesktop ? centerY : stageFocusY, intro);
    camera.setViewOffset(
      viewWidth,
      viewHeight,
      viewWidth * 0.5 - fx,
      viewHeight * 0.5 - fy,
      viewWidth,
      viewHeight,
    );
    sky.setFocus(fx / viewWidth, 1 - fy / viewHeight);
  }

  function resize() {
    if (disposed || lost) return;
    const frame = canvas.getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    viewWidth = Math.max(1, Math.round(frame.width));
    viewHeight = Math.max(1, Math.round(frame.height));
    stageFocusX = box.left - frame.left + box.width * 0.5;
    stageFocusY = box.top - frame.top + box.height * 0.47;
    const span = Math.max(1, Math.min(box.width * 0.92, box.height * 0.94));
    distance =
      (5.15 * viewHeight) /
      span /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5));

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      resolutionLimit,
      Math.sqrt(3200000 / (viewWidth * viewHeight)),
    );
    renderer.setPixelRatio(dpr);
    renderer.setSize(viewWidth, viewHeight, false);
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(viewWidth, viewHeight);
    }
    hologram.resize(dpr);
    dust.resize(dpr);

    const layout = `${viewWidth}:${viewHeight}`;
    if (layout !== skyLayout) {
      sky.resize(viewWidth, viewHeight, stageFocusX, stageFocusY);
      skyLayout = layout;
    }
    updateCameraOffset();
    schedule();
  }

  function schedule() {
    if (!animationFrame && !document.hidden && !lost && !disposed) {
      animationFrame = requestAnimationFrame(draw);
    }
  }

  function stop() {
    cancelAnimationFrame(animationFrame);
    animationFrame = lastFrame = 0;
  }

  function emitTelemetry() {
    if (!onTelemetry) return;
    const yawDeg = Math.round(THREE.MathUtils.radToDeg(orbit.rotation.y)) % 360;
    const pitchDeg = Math.round(THREE.MathUtils.radToDeg(orbit.rotation.x));
    const zoomStr = currentZoom.toFixed(2);
    const key = `${yawDeg}:${pitchDeg}:${zoomStr}`;
    if (key !== lastTelemetryKey) {
      lastTelemetryKey = key;
      onTelemetry({ yaw: yawDeg, pitch: pitchDeg, zoom: currentZoom });
    }
  }

  function draw(now) {
    animationFrame = 0;
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0;
    const dt = Math.min(elapsed || 1 / 60, 0.1);
    lastFrame = now;

    if (ready && !paused && !reduced && elapsed > 0.055) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames >= 18 && (bloomEnabled || resolutionLimit > 0.85)) {
      const nextLimit = Math.max(0.85, renderer.getPixelRatio() - 0.22);
      if (elapsed > 0.095 || nextLimit <= 0.85) bloomEnabled = false;
      resolutionLimit = Math.min(resolutionLimit, nextLimit);
      slowFrames = 0;
      resize();
    }

    if (!paused && !reduced) idleTime += dt;
    const smooth = reduced ? 1 : 1 - Math.exp(-dt * 7.2);
    const moodSmooth = reduced ? 1 : 1 - Math.exp(-dt * 4.2);

    const prevIntro = intro;
    intro = THREE.MathUtils.lerp(intro, Number(exploring), smooth);
    smoothPointerX = THREE.MathUtils.lerp(smoothPointerX, reduced ? 0 : pointerX, smooth * 0.75);
    smoothPointerY = THREE.MathUtils.lerp(smoothPointerY, reduced ? 0 : pointerY, smooth * 0.75);
    currentZoom = THREE.MathUtils.lerp(currentZoom, targetZoom, smooth);

    const parallaxScale = 1 - intro * 0.55;
    orbit.rotation.y = THREE.MathUtils.lerp(
      orbit.rotation.y,
      targetYaw + smoothPointerX * 0.11 * parallaxScale,
      smooth,
    );
    orbit.rotation.x = THREE.MathUtils.lerp(
      orbit.rotation.x,
      targetPitch + smoothPointerY * 0.08 * parallaxScale,
      smooth,
    );

    if (Math.abs(intro - prevIntro) > 0.0004) {
      updateCameraOffset();
    }

    // Subtle specular rim tracking with cursor
    rimWarm.position.x = 5.2 + smoothPointerX * 1.4;
    rimWarm.position.y = 2.2 - smoothPointerY * 1.1;

    camera.position.set(0, 0, (distance * (1.07 - intro * 0.10)) / currentZoom);

    if (progress < 1) progress = Math.min(1, progress + dt / TRANSITION_DURATION);

    const active = getSpecimen(index);
    const outgoing = getSpecimen(fromIndex);

    // Crossfade scene atmosphere & lighting to active specimen mood
    const m = active.mood;
    _targetSkyCool.set(m.skyCool);
    _targetSkyWarm.set(m.skyWarm);
    _targetKeyWarm.set(m.keyWarm);
    _targetKeyCool.set(m.keyCool);
    _targetDustWarm.set(m.dustWarm);
    _targetDustCool.set(m.dustCool);
    sky.uniforms.uCoolColor.value.lerp(_targetSkyCool, moodSmooth);
    sky.uniforms.uWarmColor.value.lerp(_targetSkyWarm, moodSmooth);
    rimWarm.color.lerp(_targetKeyWarm, moodSmooth);
    rimCool.color.lerp(_targetKeyCool, moodSmooth);
    dust.uniforms.uWarmTint.value.lerp(_targetDustWarm, moodSmooth);
    dust.uniforms.uTint.value.lerp(_targetDustCool, moodSmooth);
    if (bloom) bloom.strength = THREE.MathUtils.lerp(bloom.strength, m.bloomStrength, moodSmooth);

    sky.uniforms.uPointer.value.set(smoothPointerX, -smoothPointerY);
    sky.uniforms.uTime.value = idleTime;
    dust.uniforms.uTime.value = idleTime;
    dust.points.rotation.y = idleTime * 0.018 + smoothPointerX * 0.05;
    dust.points.rotation.x = smoothPointerY * 0.035;

    for (const specimen of specimens) {
      if (specimen) specimen.root.visible = false;
    }
    if (progress < 0.28 && active !== outgoing) {
      outgoing.root.visible = true;
      outgoing.root.scale.setScalar(1 - 0.54 * easeOut(progress / 0.28));
    }
    const arrival = easeOut(THREE.MathUtils.clamp((progress - 0.45) / 0.55, 0, 1));
    active.root.visible = progress >= 0.45;
    active.root.scale.setScalar(0.44 + arrival * 0.56);

    const floatY = 0.05 * Math.sin(idleTime * 0.64);
    orbit.position.y = floatY;
    active.root.rotation.y = active.baseYaw + 0.11 * Math.sin(idleTime * 0.34);
    active.update(idleTime, camera);

    hologram.draw(progress, progress < 1 ? Math.sin(Math.PI * progress) * 1.16 : 0);

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

    if (!ready) {
      ready = true;
      onRendered(true);
      // Warm up PMREM observatory IBL and UnrealBloom right after Frame 1 paints
      setTimeout(() => {
        initPostEffects();
        schedule();
      }, 0);
    }

    emitTelemetry();

    const moving =
      Math.abs(targetYaw - orbit.rotation.y) > 0.001 ||
      Math.abs(targetPitch - orbit.rotation.x) > 0.001 ||
      Math.abs(targetZoom - currentZoom) > 0.001 ||
      Math.abs(Number(exploring) - intro) > 0.001 ||
      progress < 1;

    if (moving || (!paused && !reduced)) schedule();
    else lastFrame = 0;
  }

  function cloud(model) {
    if (model.cloud) return model.cloud;
    const clone = model.root.clone();
    clone.scale.setScalar(1);
    clone.rotation.set(0, model.baseYaw, 0);
    model.cloud = sampleSurface(clone, POINT_COUNT);
    return model.cloud;
  }

  function select(next) {
    if (index === next) return;
    fromIndex = index;
    index = next;
    const targetSpecimen = getSpecimen(index);
    const m = targetSpecimen.mood;
    hologram.uniforms.uWarmColor.value.set(m.keyWarm);
    hologram.uniforms.uCoolColor.value.set(m.keyCool);
    if (paused || reduced) {
      progress = 1;
      applyMoodInstant(targetSpecimen);
    } else {
      hologram.setClouds(cloud(getSpecimen(fromIndex)), cloud(targetSpecimen));
      progress = 0;
    }
    reset();
  }

  function reset() {
    targetYaw = 0;
    targetPitch = 0;
    targetZoom = 1;
    schedule();
  }

  function contextLost(event) {
    event.preventDefault();
    lost = true;
    ready = false;
    stop();
    onRendered(false);
  }

  function contextRestored() {
    lost = false;
    skyLayout = '';
    lightEnvironment();
    resize();
  }

  function visibility() {
    if (document.hidden) stop();
    else schedule();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  observer.observe(stage);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  document.addEventListener('visibilitychange', visibility);

  resize();
  if (document.hidden) {
    draw(performance.now());
    lastFrame = 0;
  }

  return {
    select,
    reset,
    enter() {
      exploring = true;
      schedule();
    },
    exit() {
      exploring = false;
      targetZoom = 1;
      schedule();
    },
    orbit(dx, dy) {
      targetYaw += dx * 0.0085;
      targetPitch = THREE.MathUtils.clamp(targetPitch + dy * 0.0068, -0.82, 0.82);
      schedule();
    },
    zoom(delta) {
      targetZoom = THREE.MathUtils.clamp(targetZoom * (1 - delta * 0.0009), 0.78, 1.38);
      schedule();
    },
    setPointer(nx, ny) {
      pointerX = THREE.MathUtils.clamp(nx, -1, 1);
      pointerY = THREE.MathUtils.clamp(ny, -1, 1);
      schedule();
    },
    setMotion({ freeze, reduce }) {
      paused = freeze;
      reduced = reduce;
      if (paused || reduced) progress = 1;
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);

      const geometries = new Set();
      const materials = new Set();
      scene.traverse((part) => {
        if (part.geometry) geometries.add(part.geometry);
        if (part.material) {
          if (Array.isArray(part.material)) {
            for (const m of part.material) materials.add(m);
          } else {
            materials.add(part.material);
          }
        }
        if (part.isInstancedMesh) part.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();

      hologram.dispose();
      dust.dispose();
      bloom?.dispose();
      output?.dispose();
      composer?.dispose();
      sky.dispose();
      environment?.dispose();
      renderer.dispose();
    },
  };
}
