import * as THREE from "three";
import { createAstronaut, createAnimationClips } from "../models/astronaut.js";

const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uMobile;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec2 center=mix(vec2(.77,.50),vec2(.53,.28),uMobile);
    vec2 p=(vUv-center)*vec2(uResolution.x/uResolution.y,1.);
    float tilt=-.13; p=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*p;
    float radius=mix(.285,.175,uMobile);
    float r=length(p), a=atan(p.y,p.x);
    float stream=.55+.25*sin(a*15.+r*380.-uTime*.55)+.2*sin(r*800.+a*8.+uTime*.3);
    float ring=exp(-abs(r-radius)*110.)*.25+exp(-abs(r-radius*1.06)*44.)*.11;
    ring*=stream;
    float disk=exp(-abs(p.y+.006*sin(p.x*22.+uTime*.2))*190.);
    disk*=smoothstep(radius*.7,radius*1.1,r)*exp(-abs(p.x)*1.9)*.2;
    float glint=pow(max(0.,sin(a*3.+r*70.-uTime*.16)),12.)*exp(-abs(r-radius*1.08)*65.)*.22;
    vec3 col=vec3(.4,.49,1.)*(ring+glint)+vec3(.65,.65,.93)*disk;
    float alpha=min(.5,ring+disk+glint);
    gl_FragColor=vec4(col,alpha);
  }
`;

export function createCosmos(
  canvas,
  { reducedMotion = false, portrait = false } = {},
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 4.25, -4.25, 0.1, 100);
  camera.position.set(0, 0, 15);
  scene.add(new THREE.HemisphereLight("#d4eaff", "#2c2049", 2.8));
  const key = new THREE.DirectionalLight("#fff0cf", 4.7);
  key.position.set(-4, 6, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#a8baff", 6);
  rim.position.set(6, 3, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight("#8ab9e4", 1);
  fill.position.set(-5, -2, 4);
  scene.add(fill);
  const { mesh, bones } = createAstronaut();
  const astronaut = new THREE.Group();
  astronaut.name = "Astro_Float_Root";
  astronaut.add(mesh);
  scene.add(astronaut);
  const mixer = new THREE.AnimationMixer(mesh),
    clips = createAnimationClips();
  const floatAction = mixer.clipAction(clips[0]).play(),
    waveAction = mixer.clipAction(clips[1]).play();
  const starsGeometry = new THREE.BufferGeometry(),
    positions = [],
    colors = [];
  let seed = 431;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < (portrait ? 75 : 500); i++) {
    positions.push(
      (random() - 0.5) * 34,
      (random() - 0.5) * 18,
      -3 - random() * 8,
    );
    const c = new THREE.Color().setHSL(
      0.56 + random() * 0.15,
      0.15,
      0.55 + random() * 0.4,
    );
    colors.push(c.r, c.g, c.b);
  }
  starsGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  starsGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  const stars = new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({
      size: 0.018,
      vertexColors: true,
      transparent: true,
      opacity: portrait ? 0.18 : 0.65,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
  scene.add(stars);
  const ringMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMobile: { value: 0 },
    },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.999,1.);}",
    fragmentShader,
    blending: THREE.AdditiveBlending,
  });
  if (!portrait) {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMaterial);
    ring.renderOrder = -10;
    ring.frustumCulled = false;
    scene.add(ring);
  }
  // A gently curved safety tether follows the floating silhouette.
  let tether;
  if (!portrait) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.6, -0.3, -0.3),
      new THREE.Vector3(-1.6, -1.2, -0.8),
      new THREE.Vector3(-2.2, -0.5, -1.1),
      new THREE.Vector3(-2.7, 0.3, -1.5),
      new THREE.Vector3(-3.6, 0.1, -2),
    ]);
    tether = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 36, 0.012, 4, false),
      new THREE.MeshStandardMaterial({
        color: "#a3abb9",
        roughness: 0.9,
        transparent: true,
        opacity: 0.6,
      }),
    );
    astronaut.add(tether);
  }
  let width = 1,
    height = 1,
    mobile = false,
    immersive = false,
    paused = reducedMotion,
    active = true,
    visible = true,
    disposed = false;
  let time = 0,
    last = performance.now(),
    rotation = 0,
    targetRotation = 0,
    dragging = false,
    lastX = 0,
    waveBoost = 0;
  const pointer = new THREE.Vector2();
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    mobile = width < 760 && !portrait;
    renderer.setSize(width, height, false);
    const viewHeight = portrait ? 6.3 : 8.5;
    camera.left = (-viewHeight * width) / height / 2;
    camera.right = -camera.left;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    ringMaterial.uniforms.uResolution.value.set(width, height);
    ringMaterial.uniforms.uMobile.value = mobile ? 1 : 0;
    const scale = portrait ? 0.86 : mobile ? 0.62 : 0.77;
    astronaut.scale.setScalar(immersive ? 1.08 : scale);
    astronaut.position.x =
      portrait || immersive
        ? 0
        : (camera.right - camera.left) * (mobile ? 0.025 : 0.215);
    astronaut.position.y = portrait
      ? -0.15
      : immersive
        ? -0.15
        : mobile
          ? -1.55
          : -0.15;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
    },
    { threshold: 0 },
  );
  observer.observe(canvas);
  function frame(now) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.04);
    last = now;
    if (active && visible) {
      if (!paused) {
        time += dt;
        mixer.update(dt * (1 + waveBoost));
        waveBoost = Math.max(0, waveBoost - dt * 0.55);
      }
      rotation = THREE.MathUtils.damp(rotation, targetRotation, 6, dt);
      const baseY = portrait
        ? -0.15
        : immersive
          ? -0.15
          : mobile
            ? -1.55
            : -0.15;
      astronaut.position.y =
        baseY + (paused ? 0 : Math.sin(time * 0.72) * 0.13);
      astronaut.rotation.set(
        0.05 + pointer.y * 0.035,
        portrait
          ? -0.25 + Math.sin(time * 0.2) * 0.2 + rotation
          : -0.27 + rotation + pointer.x * 0.12,
        -0.14 + (paused ? 0 : Math.sin(time * 0.48) * 0.055),
      );
      if (portrait) astronaut.rotation.z = -0.06;
      stars.rotation.z = time * 0.002;
      ringMaterial.uniforms.uTime.value = time;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  // Render an expressive greeting even when the visitor prefers no continuous motion.
  mixer.update(0.4);
  requestAnimationFrame(frame);
  function down(e) {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      (e.clientX - rect.left) / width - 0.5,
      (e.clientY - rect.top) / height - 0.5,
    );
    if (dragging) {
      targetRotation += (e.clientX - lastX) * 0.009;
      lastX = e.clientX;
    }
  }
  function up() {
    dragging = false;
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  function visibility() {
    active = !document.hidden;
    last = performance.now();
  }
  document.addEventListener("visibilitychange", visibility);
  return {
    mesh,
    bones,
    clips,
    scene,
    renderer,
    wave() {
      waveAction.reset().play();
      waveBoost = 0.8;
      if (paused) {
        mixer.update(0.4);
        renderer.render(scene, camera);
      }
    },
    setPaused(value) {
      paused = value;
    },
    setImmersive(value) {
      immersive = value;
      resize();
    },
    setDestination(name) {
      const c = { gargantua: "#a8baff", miller: "#6edbfc", edmunds: "#ffb786" }[
        name
      ];
      rim.color.set(c);
      ringMaterial.visible = name === "gargantua";
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
      canvas.removeEventListener("pointercancel", up);
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        if (obj.material)
          for (const m of Array.isArray(obj.material)
            ? obj.material
            : [obj.material])
            m.dispose();
      });
      renderer.dispose();
    },
  };
}
