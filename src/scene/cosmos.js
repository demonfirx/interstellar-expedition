import * as THREE from "three";
import { createAstronaut, createAnimationClips } from "../models/astronaut.js";
import { blackHoleFragment, blackHoleVertex } from "./shaders/black-hole.js";
import { sampleFloat } from "../models/motion.js";

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
    camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 80);
  camera.position.z = 15;
  scene.add(new THREE.HemisphereLight("#889dcf", "#100e2a", 1.1));
  const key = new THREE.DirectionalLight("#bac9eb", 1.65);
  key.position.set(-4, 5, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#b5bfff", 4.8);
  rim.position.set(7, 2, -5);
  scene.add(rim);
  const low = new THREE.DirectionalLight("#6369ac", 0.7);
  low.position.set(-4, -3, 3);
  scene.add(low);

  const { mesh, bones } = createAstronaut(),
    astronaut = new THREE.Group();
  astronaut.name = "Astro_Float_Root";
  astronaut.add(mesh);
  scene.add(astronaut);
  const clips = createAnimationClips(),
    mixer = new THREE.AnimationMixer(mesh);
  mixer.clipAction(clips[0]).play();
  const waving = mixer.clipAction(clips[1]).play();
  const greetingClip = clips[1].clone();
  greetingClip.name = "AN_Astro_Requested_Greeting";
  const greeting = mixer.clipAction(greetingClip).setLoop(THREE.LoopOnce, 1);
  greeting.clampWhenFinished = true;
  mixer.addEventListener("finished", (event) => {
    if (event.action !== greeting) return;
    greeting.fadeOut(0.55);
    waving.reset().setEffectiveWeight(1).fadeIn(0.55).play();
  });
  mixer.update(0.45);

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
      uPointer: { value: new THREE.Vector2() },
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
    },
    undefined,
    () => {
      material.uniforms.uReady.value = 0;
    },
  );
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;

  const starPositions = [],
    starColors = [];
  let seed = 421;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  for (let i = 0; i < 350; i++) {
    starPositions.push(
      (random() - 0.5) * 28,
      (random() - 0.5) * 16,
      -3 - random() * 5,
    );
    const c = new THREE.Color().setHSL(0.64, 0.3, 0.48 + random() * 0.35);
    starColors.push(c.r, c.g, c.b);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  starGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(starColors, 3),
  );
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 0.012,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  scene.add(stars);

  const tetherCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.6, -0.25, -0.3),
    new THREE.Vector3(-1.9, -1.3, -0.8),
    new THREE.Vector3(-2.6, -0.8, -1.4),
    new THREE.Vector3(-3.5, 0.2, -2),
    new THREE.Vector3(-5.8, 0.6, -3),
  ]);
  const tether = new THREE.Mesh(
    new THREE.TubeGeometry(tetherCurve, 48, 0.009, 4, false),
    new THREE.MeshStandardMaterial({
      color: "#6d779f",
      transparent: true,
      opacity: 0.37,
      roughness: 0.8,
    }),
  );
  astronaut.add(tether);

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
    downX = 0,
    downY = 0,
    baseX = 0,
    baseY = 0;
  const pointer = new THREE.Vector2();
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    mobile = width / height < 0.9;
    renderer.setSize(width, height, false);
    const h = 9;
    camera.left = (-h * width) / height / 2;
    camera.right = -camera.left;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(width, height);
    astronaut.scale.setScalar(mobile ? 0.47 : 0.57);
    baseX = (camera.right - camera.left) * (mobile ? -0.12 : -0.23);
    baseY = mobile ? -1.55 : -0.35;
    astronaut.position.set(baseX, baseY, 0);
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
        mixer.update(dt);
      }
      rotation = THREE.MathUtils.damp(rotation, targetRotation, 5, dt);
      const drift = sampleFloat(time);
      astronaut.position.set(
        baseX + drift.position.x,
        baseY + drift.position.y,
        drift.position.z,
      );
      const counterbalance = (bones.L_arm_upper.rotation.z - 0.22) * 0.018;
      astronaut.rotation.set(
        drift.rotation.x + pointer.y * 0.035,
        drift.rotation.y + rotation + pointer.x * 0.13,
        drift.rotation.z - counterbalance,
      );
      material.uniforms.uTime.value = time;
      material.uniforms.uPointer.value.lerp(pointer, paused ? 0 : 0.025);
      stars.rotation.z = time * 0.0015;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function wave() {
    if (paused || greeting.isRunning()) return;
    if (
      waving.getEffectiveWeight() > 0.5 &&
      waving.time > 0.4 &&
      waving.time < 6.3
    )
      return;
    greeting.reset().setEffectiveWeight(1).fadeIn(0.55).play();
    waving.fadeOut(0.55);
  }
  function down(e) {
    if (e.button !== 0) return;
    dragging = true;
    downX = lastX = e.clientX;
    downY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e) {
    pointer.set(e.clientX / width - 0.5, e.clientY / height - 0.5);
    if (dragging) {
      targetRotation += (e.clientX - lastX) * 0.009;
      lastX = e.clientX;
    }
  }
  function up(e) {
    if (dragging && Math.hypot(e.clientX - downX, e.clientY - downY) < 8)
      wave();
    dragging = false;
  }
  function cancel() {
    dragging = false;
  }
  function visibility() {
    active = !document.hidden;
    last = performance.now();
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  document.addEventListener("visibilitychange", visibility);
  return {
    mesh,
    bones,
    clips,
    scene,
    renderer,
    wave,
    setPaused(value) {
      paused = value;
    },
    resetCamera() {
      targetRotation = 0;
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
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      });
      texture.dispose();
      renderer.dispose();
    },
  };
}
