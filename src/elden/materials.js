import * as THREE from "three";

/**
 * Generates a Sobel-derived tangent-space normal map from a grayscale height canvas.
 */
function heightCanvasToNormalTexture(heightCanvas, strength = 2.4, repeatX = 1, repeatY = 1) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext("2d");
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const cx = ((x % w) + w) % w;
    const cy = ((y % h) + h) % h;
    return src[(cy * w + cx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Deterministic PRNG for clean, repeatable procedural textures.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a custom gilded storm-temple PMREM environment so obsidian, gold,
 * and steel armor pick up rich warm amber and cool storm-blue reflections.
 */
export function createFarumEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x161214);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const addPanel = (colorHex, intensity, pos, scale, lookAt = [0, 0, 0]) => {
    const col = new THREE.Color(colorHex).multiplyScalar(intensity);
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.set(...pos);
    mesh.scale.set(...scale, 1);
    mesh.lookAt(...lookAt);
    envScene.add(mesh);
  };

  // Golden storm-sun break overhead-front
  addPanel(0xffd28e, 4.2, [14, 18, -14], [22, 14]);
  // Secondary amber storm halo
  addPanel(0xe59c4d, 2.2, [-16, 12, -10], [18, 12]);
  // Cool twilight tempest rim light
  addPanel(0x6e85a8, 1.9, [-14, 9, 18], [24, 14]);
  // Subtle crimson abyssal under-bounce
  addPanel(0x9a2c2b, 1.3, [0, -14, 0], [32, 32]);
  // Warm horizon ring bands for metallic specular sweeps
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addPanel(i % 2 === 0 ? 0xc79458 : 0x5c6d84, 1.4, [Math.cos(a) * 22, 4, Math.sin(a) * 22], [12, 6]);
  }

  let envRT;
  try {
    envRT = pmrem.fromScene(envScene, 0.035);
  } finally {
    envScene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    pmrem.dispose();
  }
  return envRT;
}

/**
 * 1024x1024 carved Farum Azula coliseum floor PBR set:
 * weathered basalt flagstones, mortar joints, radial cracks, and metallic gold rune inlays.
 */
export function createArenaFloorTextures() {
  const size = 1024;
  const cx = size / 2;
  const cy = size / 2;
  const rand = mulberry32(1337);

  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext("2d");

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = heightCanvas.height = size;
  const hCtx = heightCanvas.getContext("2d");

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = roughCanvas.height = size;
  const rCtx = roughCanvas.getContext("2d");

  const metalCanvas = document.createElement("canvas");
  metalCanvas.width = metalCanvas.height = size;
  const mCtx = metalCanvas.getContext("2d");

  // Base weathered slate-sandstone fill
  aCtx.fillStyle = "#3a342d";
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = "#989898";
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = "#d8d8d8";
  rCtx.fillRect(0, 0, size, size);
  mCtx.fillStyle = "#080808";
  mCtx.fillRect(0, 0, size, size);

  // Subtle multi-scale weathered mottling & dust patches
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 6 + rand() * 54;
    const v = 38 + Math.floor(rand() * 44);
    const warm = Math.floor(rand() * 14);
    aCtx.fillStyle = `rgba(${v + warm + 10}, ${v + warm + 3}, ${v - 4}, 0.16)`;
    aCtx.beginPath();
    aCtx.arc(x, y, r, 0, Math.PI * 2);
    aCtx.fill();

    const hv = 115 + Math.floor(rand() * 55);
    hCtx.fillStyle = `rgba(${hv}, ${hv}, ${hv}, 0.14)`;
    hCtx.beginPath();
    hCtx.arc(x, y, r * 0.75, 0, Math.PI * 2);
    hCtx.fill();

    const rv = 170 + Math.floor(rand() * 75);
    rCtx.fillStyle = `rgba(${rv}, ${rv}, ${rv}, 0.18)`;
    rCtx.beginPath();
    rCtx.arc(x, y, r, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Concentric stepped stone flagstone rings
  const ringRadii = [68, 134, 206, 282, 356, 428, 488];
  ringRadii.forEach((rad, rIdx) => {
    const segs = 12 + rIdx * 6;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2 + (rIdx % 2) * (Math.PI / segs);
      const a1 = ((s + 1) / segs) * Math.PI * 2 + (rIdx % 2) * (Math.PI / segs);
      const innerR = rIdx === 0 ? 18 : ringRadii[rIdx - 1];
      const tone = 44 + Math.floor(rand() * 26);

      aCtx.beginPath();
      aCtx.arc(cx, cy, rad - 2, a0 + 0.005, a1 - 0.005);
      aCtx.arc(cx, cy, innerR + 2, a1 - 0.005, a0 + 0.005, true);
      aCtx.closePath();
      aCtx.fillStyle = `rgba(${tone + 14}, ${tone + 8}, ${tone}, 0.24)`;
      aCtx.fill();

      const ht = 135 + Math.floor(rand() * 48);
      hCtx.beginPath();
      hCtx.arc(cx, cy, rad - 2, a0 + 0.005, a1 - 0.005);
      hCtx.arc(cx, cy, innerR + 2, a1 - 0.005, a0 + 0.005, true);
      hCtx.closePath();
      hCtx.fillStyle = `rgba(${ht}, ${ht}, ${ht}, 0.28)`;
      hCtx.fill();
    }
  });

  // Recessed mortar seams (concentric & radial)
  const drawMortar = (ctx, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const rad of ringRadii) {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ringRadii.forEach((rad, rIdx) => {
      const segs = 12 + rIdx * 6;
      const innerR = rIdx === 0 ? 18 : ringRadii[rIdx - 1];
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2 + (rIdx % 2) * (Math.PI / segs);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
        ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
        ctx.stroke();
      }
    });
  };
  drawMortar(aCtx, "rgba(14, 11, 9, 0.72)", 3.2);
  drawMortar(hCtx, "rgba(28, 28, 28, 0.92)", 4.2);
  drawMortar(rCtx, "rgba(245, 245, 245, 0.85)", 4.0);

  // Fractured battle cracks radiating across flagstones
  for (let c = 0; c < 34; c++) {
    let x = cx + (rand() - 0.5) * size * 0.82;
    let y = cy + (rand() - 0.5) * size * 0.82;
    let ang = rand() * Math.PI * 2;
    const steps = 6 + Math.floor(rand() * 10);
    aCtx.strokeStyle = "rgba(12, 9, 8, 0.52)";
    aCtx.lineWidth = 1.6;
    hCtx.strokeStyle = "rgba(18, 18, 18, 0.85)";
    hCtx.lineWidth = 2.4;

    aCtx.beginPath();
    hCtx.beginPath();
    aCtx.moveTo(x, y);
    hCtx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      ang += (rand() - 0.5) * 0.9;
      const len = 10 + rand() * 24;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      aCtx.lineTo(x, y);
      hCtx.lineTo(x, y);
    }
    aCtx.stroke();
    hCtx.stroke();
  }

  // Ornate inlaid gilded Elden Rune geometry (metallic, smooth gold grooves!)
  const drawGoldInlay = (ctx, stroke, width) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    // Center Great Rune interlocking rings
    const centerRings = [134, 146, 282, 292, 428];
    for (const r of centerRings) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 3 interlocking Elden circles inside central dais
    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * 44, cy + Math.sin(ang) * 44, 66, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Central vertical axis spear
    ctx.beginPath();
    ctx.moveTo(cx, cy - 134);
    ctx.lineTo(cx, cy + 134);
    ctx.stroke();

    // 8 ceremonial compass rays & tick marks
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 146, cy + Math.sin(a) * 146);
      ctx.lineTo(cx + Math.cos(a) * 282, cy + Math.sin(a) * 282);
      ctx.stroke();
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const inner = i % 6 === 0 ? 296 : 306;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * 316, cy + Math.sin(a) * 316);
      ctx.stroke();
    }
  };

  drawGoldInlay(aCtx, "rgba(198, 155, 76, 0.85)", 4.2);
  drawGoldInlay(hCtx, "rgba(235, 235, 235, 0.9)", 5.0);
  drawGoldInlay(rCtx, "rgba(72, 72, 72, 0.92)", 5.5);
  drawGoldInlay(mCtx, "rgba(220, 220, 220, 0.95)", 5.5);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 2.8, 1, 1);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = 4;

  const metalnessMap = new THREE.CanvasTexture(metalCanvas);
  metalnessMap.anisotropy = 4;

  return { map, normalMap, roughnessMap, metalnessMap };
}

/**
 * Tiled carved temple limestone PBR textures for pillars, arches, and ruins.
 */
export function createTempleStoneTextures(repeatX = 2, repeatY = 4) {
  const size = 512;
  const rand = mulberry32(4096);

  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext("2d");

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = heightCanvas.height = size;
  const hCtx = heightCanvas.getContext("2d");

  aCtx.fillStyle = "#52493f";
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = "#949494";
  hCtx.fillRect(0, 0, size, size);

  // Layered sedimentary grain + weathering
  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 14 + rand() * 68;
    const h = 4 + rand() * 16;
    const v = 54 + Math.floor(rand() * 44);
    aCtx.fillStyle = `rgba(${v + 12}, ${v + 6}, ${v - 2}, 0.2)`;
    aCtx.fillRect(x, y, w, h);

    const hv = 105 + Math.floor(rand() * 75);
    hCtx.fillStyle = `rgba(${hv}, ${hv}, ${hv}, 0.22)`;
    hCtx.fillRect(x, y, w, h);
  }

  // Horizontal masonry courses + staggered vertical joints
  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    aCtx.fillStyle = "rgba(18, 15, 12, 0.65)";
    aCtx.fillRect(0, y, size, 3);
    hCtx.fillStyle = "rgba(25, 25, 25, 0.9)";
    hCtx.fillRect(0, y, size, 4);

    const cols = 4;
    const offset = (r % 2) * (size / (cols * 2));
    for (let c = 0; c < cols; c++) {
      const x = (c * (size / cols) + offset) % size;
      aCtx.fillRect(x, y, 2.5, rowH);
      hCtx.fillRect(x, y, 3.5, rowH);
    }
  }

  // Dark soot & rain streaks near seams
  const grad = aCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "rgba(14, 11, 9, 0.35)");
  grad.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  grad.addColorStop(1, "rgba(14, 11, 9, 0.35)");
  aCtx.fillStyle = grad;
  aCtx.fillRect(0, 0, size, size);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = 4;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 2.2, repeatX, repeatY);
  return { map, normalMap };
}

/**
 * Forged Damascus / engraved armor bump + roughness texture so armor looks crafted, not plastic.
 */
export function createForgedMetalTextures() {
  const size = 256;
  const rand = mulberry32(9001);

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = heightCanvas.height = size;
  const hCtx = heightCanvas.getContext("2d");

  hCtx.fillStyle = "#808080";
  hCtx.fillRect(0, 0, size, size);

  // Fine hammered grain & directional brushed steel scratches
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 42;
    const v = 100 + Math.floor(rand() * 65);
    hCtx.strokeStyle = `rgba(${v}, ${v}, ${v}, 0.25)`;
    hCtx.lineWidth = 1 + rand() * 1.5;
    hCtx.beginPath();
    hCtx.moveTo(x, y);
    hCtx.lineTo(x + len, y + (rand() - 0.5) * 6);
    hCtx.stroke();
  }

  // Subtle decorative filigree borders
  hCtx.strokeStyle = "rgba(220, 220, 220, 0.35)";
  hCtx.lineWidth = 2;
  for (let y = 24; y < size; y += 64) {
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) {
      hCtx.lineTo(x, y + Math.sin((x / size) * Math.PI * 8) * 6);
    }
    hCtx.stroke();
  }

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 1.4, 2, 2);
  return { normalMap };
}

/**
 * Woven cloth texture + tattered battle-worn hem alphaMap for capes.
 */
export function createTatteredClothTextures(baseHex, accentHex) {
  const w = 256;
  const h = 384;
  const rand = mulberry32(7722);

  const colCanvas = document.createElement("canvas");
  colCanvas.width = w;
  colCanvas.height = h;
  const cCtx = colCanvas.getContext("2d");

  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = w;
  alphaCanvas.height = h;
  const alCtx = alphaCanvas.getContext("2d");

  // Rich vertical gradient + cloth weave
  const grad = cCtx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, baseHex);
  grad.addColorStop(0.75, baseHex);
  grad.addColorStop(1, "#0b0708");
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, w, h);

  // Subtle gold embroidered border stripes along left/right edges
  cCtx.fillStyle = accentHex;
  cCtx.globalAlpha = 0.55;
  cCtx.fillRect(10, 0, 5, h * 0.82);
  cCtx.fillRect(w - 15, 0, 5, h * 0.82);
  cCtx.globalAlpha = 1;

  // Fabric thread weave & grime
  for (let y = 0; y < h; y += 3) {
    cCtx.fillStyle = y % 6 === 0 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)";
    cCtx.fillRect(0, y, w, 1.5);
  }
  for (let x = 0; x < w; x += 4) {
    cCtx.fillStyle = "rgba(0,0,0,0.045)";
    cCtx.fillRect(x, 0, 1, h);
  }

  // Alpha mask: solid top 70%, organically frayed & torn bottom 30%
  alCtx.fillStyle = "#ffffff";
  alCtx.fillRect(0, 0, w, h);

  // Cut ragged triangular tears up from the bottom hem
  alCtx.fillStyle = "#000000";
  const tearCount = 18;
  for (let i = 0; i < tearCount; i++) {
    const tx = (i / tearCount) * w + (rand() - 0.5) * 14;
    const tw = 8 + rand() * 20;
    const th = 38 + rand() * 88;
    alCtx.beginPath();
    alCtx.moveTo(tx - tw * 0.5, h);
    alCtx.lineTo(tx, h - th);
    alCtx.lineTo(tx + tw * 0.5, h);
    alCtx.closePath();
    alCtx.fill();
  }
  // Small battle burn holes near lower edge
  for (let i = 0; i < 12; i++) {
    alCtx.beginPath();
    alCtx.arc(24 + rand() * (w - 48), h * 0.72 + rand() * (h * 0.2), 3 + rand() * 7, 0, Math.PI * 2);
    alCtx.fill();
  }

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const alphaMap = new THREE.CanvasTexture(alphaCanvas);

  return { map, alphaMap };
}

/**
 * Custom GLSL ShaderMaterial for Destined Death black-and-crimson living runes
 * on Maerith's Black Blade and chest seal.
 */
export function createDestinedDeathShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform float uTime;
      uniform float uIntensity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vec2(vUv.x * 2.4, vUv.y * 7.0 - uTime * 2.8);
        float n = fbm(uv + vec2(fbm(uv * 1.4 + uTime * 0.8), 0.0));
        float vein = smoothstep(0.36, 0.72, n);
        float hotCore = smoothstep(0.66, 0.92, n);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vViewDir))), 2.2);

        vec3 darkFlame = vec3(0.06, 0.01, 0.02);
        vec3 crimson = vec3(2.8, 0.14, 0.22);
        vec3 goldHot = vec3(4.2, 1.35, 0.45);

        vec3 col = mix(darkFlame, crimson, vein);
        col = mix(col, goldHot, hotCore * 0.75);
        col += crimson * fresnel * 0.95;
        col *= uIntensity;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
