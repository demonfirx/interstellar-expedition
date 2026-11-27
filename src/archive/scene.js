import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createArchiveModels } from './models.js';
import { sampleSurface } from './surface.js';
import { createArchiveSky, createHologram } from './visuals.js';

const POINT_COUNT = 4800;
const TRANSITION_DURATION = .93;
const easeOut = (t) => 1 - (1 - t) ** 3;

export function createArchiveScene(canvas, stage, onRendered) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .12, 90);
  const sky = createArchiveSky(renderer);
  scene.add(sky.sky);
  scene.add(new THREE.HemisphereLight('#b5dcff', '#404967', 1.02));
  function addLight(color, intensity, x, y, z) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }
  addLight('#e0eeff', 3.05, -4, 4, 3);
  addLight('#75bfff', 2.8, -3, -1, -4);
  addLight('#ffac67', 3.7, 5, 2, -1);
  addLight('#aabfe1', .58, 2, -4, 5);

  let environment;
  function lightEnvironment() {
    environment?.dispose();
    const studio = new RoomEnvironment();
    const filter = new THREE.PMREMGenerator(renderer);
    try {
      environment = filter.fromScene(studio, .026, .1, 100, { size: 128 });
      scene.environment = environment.texture;
      scene.environmentIntensity = .72;
      scene.environmentRotation.y = -.45;
    } finally {
      studio.dispose();
      filter.dispose();
    }
  }
  lightEnvironment();

  const orbit = new THREE.Group();
  scene.add(orbit);
  const specimens = createArchiveModels.map((build) => {
    const model = build();
    orbit.add(model.root);
    model.root.visible = false;
    return model;
  });
  const hologram = createHologram(POINT_COUNT);
  orbit.add(hologram.points);

  let composer;
  let bloom;
  let output;
  if (renderer.extensions.has('EXT_color_buffer_float')) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
    composer = new EffectComposer(renderer, target);
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .54, .42, .94);
    output = new OutputPass();
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(output);
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
  let distance = 11;
  let resolutionLimit = 1.65;
  let bloomEnabled = Boolean(composer);
  let slowFrames = 0;
  let skyLayout = '';

  function resize() {
    if (disposed || lost) return;
    const frame = canvas.getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(frame.width));
    const height = Math.max(1, Math.round(frame.height));
    const focusX = box.left - frame.left + box.width * .5;
    const focusY = box.top - frame.top + box.height * .465;
    const span = Math.max(1, Math.min(box.width * .94, box.height * .98));
    distance = 5.02 * height / span / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * .5));
    const dpr = Math.min(window.devicePixelRatio, resolutionLimit, Math.sqrt(3050000 / (width * height)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
    }
    hologram.resize(dpr);
    camera.setViewOffset(width, height, width * .5 - focusX, height * .5 - focusY, width, height);
    const layout = `${width}:${height}:${focusX}:${focusY}`;
    if (layout !== skyLayout) {
      sky.resize(width, height, focusX, focusY);
      skyLayout = layout;
    }
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

  function draw(now) {
    animationFrame = 0;
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0;
    const dt = Math.min(elapsed || 1 / 60, .10);
    lastFrame = now;
    if (ready && !paused && !reduced && elapsed > .034) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames >= 6 && (bloomEnabled || resolutionLimit > .82)) {
      const nextLimit = Math.max(.82, renderer.getPixelRatio() - .22);
      if (elapsed > .067 || nextLimit <= .82) bloomEnabled = false;
      resolutionLimit = Math.min(resolutionLimit, nextLimit);
      slowFrames = 0;
      resize();
    }
    if (!paused && !reduced) idleTime += dt;
    const smooth = reduced ? 1 : 1 - Math.exp(-dt * 7.5);
    intro = THREE.MathUtils.lerp(intro, Number(exploring), smooth);
    orbit.rotation.y = THREE.MathUtils.lerp(orbit.rotation.y, targetYaw, smooth);
    orbit.rotation.x = THREE.MathUtils.lerp(orbit.rotation.x, targetPitch, smooth);
    camera.position.set(0, 0, distance * (1.055 - intro * .13));
    if (progress < 1) progress = Math.min(1, progress + dt / TRANSITION_DURATION);

    const active = specimens[index];
    const outgoing = specimens[fromIndex];
    for (const specimen of specimens) specimen.root.visible = false;
    if (progress < .28 && active !== outgoing) {
      outgoing.root.visible = true;
      outgoing.root.scale.setScalar(1 - .53 * easeOut(progress / .28));
    }
    const arrival = easeOut(THREE.MathUtils.clamp((progress - .47) / .53, 0, 1));
    active.root.visible = progress >= .47;
    active.root.scale.setScalar(.45 + arrival * .55);
    const float = .055 * Math.sin(idleTime * .66);
    orbit.position.y = float;
    active.root.rotation.y = active.baseYaw + .12 * Math.sin(idleTime * .36);
    active.update(idleTime);
    hologram.draw(progress, progress < 1 ? Math.sin(Math.PI * progress) * 1.14 : 0);
    if (bloomEnabled) composer.render(dt);
    else renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      onRendered(true);
    }
    const moving = Math.abs(targetYaw - orbit.rotation.y) > .001
      || Math.abs(targetPitch - orbit.rotation.x) > .001
      || Math.abs(Number(exploring) - intro) > .001 || progress < 1;
    if (moving || (!paused && !reduced)) schedule();
    else lastFrame = 0;
  }

  function cloud(model) {
    if (model.cloud) return model.cloud;
    // Sample before posing the model so the cloud remains local to the orbit rig.
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
    if (paused || reduced) progress = 1;
    else {
      hologram.setClouds(cloud(specimens[fromIndex]), cloud(specimens[index]));
      progress = 0;
    }
    reset();
  }

  function reset() {
    targetYaw = targetPitch = 0;
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
    select, reset,
    enter() { exploring = true; schedule(); },
    orbit(dx, dy) {
      targetYaw += dx * .009;
      targetPitch = THREE.MathUtils.clamp(targetPitch + dy * .007, -.78, .78);
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
        if (part.material) materials.add(part.material);
        if (part.isInstancedMesh) part.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      bloom?.dispose();
      output?.dispose();
      composer?.dispose();
      sky.dispose();
      environment?.dispose();
      renderer.dispose();
    },
  };
}
