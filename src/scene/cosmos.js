import * as THREE from "three";
import { createSailingVessel } from "../models/sailing-vessel.js";
import { blackHoleFragment, blackHoleVertex } from "./shaders/black-hole.js";
import { sampleSailingMotion, SEA_LEVEL } from "../models/sea-motion.js";
import { sampleCameraMotion } from "./camera-motion.js";
import { createAccretionLighting } from "./accretion-lighting.js";
import { createCosmicOcean } from "./cosmic-ocean.js";

export function createCosmos(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x04040c, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      (2 * Math.atan(4.5 / 15) * 180) / Math.PI,
      1,
      0.1,
      100,
    );
  camera.position.z = 15;
  scene.add(new THREE.HemisphereLight("#889dcf", "#100e2a", 0.8));
  const key = new THREE.DirectionalLight("#bac9eb", 1.2);
  key.position.set(-4, 5, 8);
  scene.add(key);
  const low = new THREE.DirectionalLight("#6369ac", 0.7);
  low.position.set(-4, -3, 3);
  scene.add(low);

  const vessel = createSailingVessel();
  scene.add(vessel.root);
  const accretionLighting = createAccretionLighting({
    scene,
    renderer,
    vessel,
  });
  const ocean = createCosmicOcean(scene);

  const material = new THREE.ShaderMaterial({
    vertexShader: blackHoleVertex,
    fragmentShader: blackHoleFragment,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    transparent: false,
    uniforms: {
      uImage: { value: null },
      uReady: { value: 0 },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCameraOffset: { value: new THREE.Vector2() },
      uCameraScale: { value: 1 },
    },
  });
  const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  background.frustumCulled = false;
  background.renderOrder = -100;
  scene.add(background);
  let disposed = false;
  const texture = new THREE.TextureLoader().load(
    "/assets/gargantua-reference.webp",
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.colorSpace = THREE.SRGBColorSpace;
      material.uniforms.uImage.value = loaded;
      material.uniforms.uReady.value = 1;
      ocean.setSource(loaded);
      try {
        accretionLighting.setSource(loaded);
      } catch (error) {
        console.warn("Environment prefilter unavailable:", error);
      }
    },
    undefined,
    () => {
      material.uniforms.uReady.value = 0;
    },
  );
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;

  let seed = 421;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function starLayer(name, count, spread, nearZ, depth, size, opacity) {
    const positions = [],
      colors = [];
    for (let i = 0; i < count; i++) {
      positions.push(
        (random() - 0.5) * spread,
        (random() - 0.5) * spread * 0.64,
        nearZ - random() * depth,
      );
      const c = new THREE.Color().setHSL(0.64, 0.3, 0.48 + random() * 0.35);
      colors.push(c.r, c.g, c.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    );
    points.name = name;
    scene.add(points);
    return points;
  }
  const farStars = starLayer("Distant_Stars", 260, 72, -25, 20, 0.055, 0.22);
  const middleStars = starLayer("Middle_Stars", 140, 45, -5, 15, 0.04, 0.3);
  const nearStars = starLayer("Foreground_Dust", 32, 20, 7, 4, 0.025, 0.34);

  let width = 1,
    height = 1,
    mobile = false,
    time = 0,
    last = performance.now(),
    paused = reducedMotion,
    active = !document.hidden,
    visible = true,
    rotation = 0,
    targetRotation = 0,
    dragging = false,
    lastX = 0,
    baseX = 0;
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    mobile = width / height < 0.9;
    renderer.setSize(width, height, false);
    const h = 9;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(width, height);
    vessel.root.scale.setScalar(mobile ? 0.57 : 0.72);
    baseX = h * camera.aspect * (mobile ? -0.075 : -0.17);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  observer.observe(canvas);
  function frame(now) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.04);
    last = now;
    if (active && visible) {
      if (!paused) {
        time += dt;
        vessel.updateSails(time);
        smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 2.2));
      }
      const cameraMotion = sampleCameraMotion(time, smoothPointer);
      camera.position.set(
        cameraMotion.position.x,
        cameraMotion.position.y,
        cameraMotion.position.z,
      );
      camera.lookAt(
        cameraMotion.target.x,
        cameraMotion.target.y,
        cameraMotion.target.z,
      );
      material.uniforms.uCameraOffset.value.set(
        cameraMotion.background.x,
        cameraMotion.background.y,
      );
      material.uniforms.uCameraScale.value = cameraMotion.background.scale;
      rotation = THREE.MathUtils.damp(rotation, targetRotation, 5, dt);
      const sailing = sampleSailingMotion(time, baseX);
      vessel.root.position.set(sailing.x, SEA_LEVEL + sailing.y, sailing.z);
      vessel.root.rotation.set(
        sailing.roll,
        sailing.yaw + rotation,
        sailing.pitch,
      );
      ocean.update(
        time,
        sailing.x,
        sailing.z,
        vessel.root.rotation.y,
        renderer,
      );
      material.uniforms.uTime.value = time;
      accretionLighting.update(time, camera.aspect);
      farStars.rotation.z = time * 0.00035;
      middleStars.rotation.z = time * 0.0007;
      nearStars.rotation.z = time * 0.001;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function down(e) {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (dragging) {
      targetRotation += (e.clientX - lastX) * 0.009;
      lastX = e.clientX;
    } else if (e.pointerType !== "touch") {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        THREE.MathUtils.clamp((e.clientX - rect.left) / width - 0.5, -0.5, 0.5),
        THREE.MathUtils.clamp((e.clientY - rect.top) / height - 0.5, -0.5, 0.5),
      );
    }
  }
  function up(e) {
    dragging = false;
    if (e.pointerType === "touch") pointer.set(0, 0);
  }
  function cancel() {
    dragging = false;
    pointer.set(0, 0);
  }
  function leave() {
    if (!dragging) pointer.set(0, 0);
  }
  function visibility() {
    active = !document.hidden;
    last = performance.now();
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", visibility);
  return {
    vessel,
    scene,
    renderer,
    setPaused(value) {
      paused = value;
    },
    resetCamera() {
      targetRotation = 0;
      pointer.set(0, 0);
    },
    dispose() {
      disposed = true;
      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("pointerleave", leave);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      });
      texture.dispose();
      accretionLighting.dispose();
      renderer.dispose();
    },
  };
}
