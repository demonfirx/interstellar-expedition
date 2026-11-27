import * as THREE from "three";

/**
 * Dynamic 3D ribbon blade trail using a custom GLSL energy slash shader:
 * crisp hot core + smoky jagged trailing edge, bloom-ready HDR luminance.
 */
export function createBladeTrail(
  scene,
  { color = 0xffe2a8, coreColor = 0xffffff, maxSamples = 16, crimsonDark = false } = {}
) {
  const samples = [];
  const vertexCount = maxSamples * 2;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = [];

  for (let i = 0; i < maxSamples - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  for (let i = 0; i < maxSamples; i++) {
    const u = i / (maxSamples - 1);
    uvs[i * 4] = u;
    uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = u;
    uvs[i * 4 + 3] = 1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: crimsonDark ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCoreColor: { value: new THREE.Color(coreColor) },
      uCount: { value: 0 },
      uMaxSamples: { value: maxSamples },
      uCrimsonDark: { value: crimsonDark ? 1.0 : 0.0 },
      uTime: { value: 0 },
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
      uniform vec3 uColor;
      uniform vec3 uCoreColor;
      uniform float uCount;
      uniform float uMaxSamples;
      uniform float uCrimsonDark;
      uniform float uTime;

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

      void main() {
        float activeSpan = max(1.0, uCount - 1.0) / max(1.0, uMaxSamples - 1.0);
        float t = vUv.x / max(0.001, activeSpan);
        if (t > 1.0) discard;

        float n = noise(vec2(t * 11.0 - uTime * 9.0, vUv.y * 7.0));
        // Taper BOTH leading tip and trailing tail smoothly (never a hard rectangular sheet!)
        float leadFade = smoothstep(0.0, 0.16, t);
        float tailFade = pow(max(0.0, 1.0 - t), 2.1);
        float alongFade = leadFade * tailFade;
        // Thin crescent focused tightly near the outer cutting edge of the blade
        float bladeEdge = smoothstep(0.38, 0.88, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
        float streaks = 0.45 + 0.55 * n;

        float alpha = alongFade * bladeEdge * streaks * 0.62;
        if (alpha < 0.01) discard;

        vec3 col = mix(uColor * 1.15, uCoreColor * 1.65, smoothstep(0.68, 0.94, vUv.y) * (1.0 - t * 0.5));

        if (uCrimsonDark > 0.5) {
          vec3 blackFlame = vec3(0.05, 0.005, 0.015);
          float vein = smoothstep(0.32, 0.82, vUv.y * 0.8 + n * 0.4);
          col = mix(blackFlame, uColor * 1.85, vein);
          col = mix(col, uCoreColor * 2.2, smoothstep(0.78, 0.96, vUv.y * n + vUv.y * 0.45));
          alpha = clamp(alongFade * bladeEdge * streaks * 0.78, 0.0, 0.82);
        }

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  scene.add(mesh);

  let elapsed = 0;

  return {
    update(active, baseWorldPos, tipWorldPos, dt = 0.016) {
      elapsed += dt;
      mat.uniforms.uTime.value = elapsed;

      if (active) {
        samples.unshift({
          base: baseWorldPos.clone(),
          tip: tipWorldPos.clone(),
        });
        if (samples.length > maxSamples) samples.pop();
      } else if (samples.length > 0) {
        samples.pop();
      }

      if (samples.length < 4) {
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      const posAttr = geo.attributes.position;
      const count = samples.length;
      mat.uniforms.uCount.value = count;

      for (let i = 0; i < maxSamples; i++) {
        const s = samples[Math.min(i, count - 1)];
        const idxBase = i * 2;
        const idxTip = idxBase + 1;
        posAttr.setXYZ(idxBase, s.base.x, s.base.y, s.base.z);
        posAttr.setXYZ(idxTip, s.tip.x, s.tip.y, s.tip.z);
      }
      posAttr.needsUpdate = true;
    },
    clear() {
      samples.length = 0;
      mesh.visible = false;
    },
  };
}

/**
 * Custom GLSL shockwave ring shader (jagged rune energy pulse expanding over the flagstones).
 */
function createShockwaveMaterial(crimson) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(crimson ? 0xff1e2d : 0xffd27a) },
      uCore: { value: new THREE.Color(crimson ? 0xff9a66 : 0xfff4d0) },
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
      uniform vec3 uCore;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float ang = atan(p.y, p.x);

        float jag = 0.04 * sin(ang * 14.0 + uProgress * 8.0) + 0.025 * cos(ang * 23.0 - uProgress * 6.0);
        float ringDist = abs(r - (0.76 + jag));
        float band = exp(-ringDist * ringDist * 95.0);
        float innerWash = smoothstep(0.84, 0.28, r) * (1.0 - smoothstep(0.0, 0.45, r)) * 0.35;

        float fade = pow(1.0 - uProgress, 1.35);
        vec3 col = mix(uColor * 2.4, uCore * 3.6, band);
        float alpha = (band * 0.95 + innerWash) * fade;
        if (r > 1.0 || alpha < 0.005) discard;

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Custom GLSL Destined Death projectile crescent slash wave.
 */
function createDestinedWaveMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
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
      void main() {
        float arc = sin(vUv.x * 3.14159);
        float width = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float ripple = 0.72 + 0.28 * sin(vUv.x * 28.0 - uTime * 16.0);
        float energy = pow(max(0.0, arc), 0.7) * pow(max(0.0, width), 1.4) * ripple;
        vec3 crimson = vec3(3.2, 0.14, 0.24);
        vec3 hot = vec3(4.5, 1.35, 0.55);
        vec3 col = mix(crimson, hot, smoothstep(0.55, 0.95, energy));
        gl_FragColor = vec4(col, clamp(energy * 1.15, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Custom GLSL Phase 2 Destined Death black-and-crimson eruption vortex pillar.
 */
function createPillarVortexMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
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
      uniform float uProgress;
      void main() {
        float spiral = sin(vUv.x * 31.4159 + vUv.y * 14.0 - uTime * 15.0) * 0.5 + 0.5;
        float streak = sin(vUv.x * 62.83 - vUv.y * 9.0 + uTime * 11.0) * 0.5 + 0.5;
        float vMask = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float fade = 1.0 - smoothstep(0.25, 1.0, uProgress);

        float flame = (spiral * 0.65 + streak * 0.35) * vMask;
        vec3 crimson = vec3(3.4, 0.14, 0.25);
        vec3 gold = vec3(4.2, 1.2, 0.45);
        vec3 col = mix(crimson, gold, smoothstep(0.65, 0.95, flame));

        gl_FragColor = vec4(col, flame * fade * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createVFXManager(scene) {
  const shockwaves = [];
  const pillars = [];
  const projectileMeshes = new Map();
  let elapsed = 0;

  // Shared geometries (zero per-event geometry allocations!)
  const shockwaveGeo = new THREE.PlaneGeometry(2.2, 2.2);
  const pillarOuterGeo = new THREE.CylinderGeometry(1.6, 2.9, 22, 28, 1, true);
  const pillarCoreGeo = new THREE.CylinderGeometry(0.75, 1.45, 22, 20, 1, true);
  const waveMat = createDestinedWaveMaterial();

  // Pooled GPU-friendly circular glowing spark points (NO BoxGeometry cubes!)
  const MAX_SPARKS = 260;
  const sparkPos = new Float32Array(MAX_SPARKS * 3);
  const sparkCol = new Float32Array(MAX_SPARKS * 3);
  const sparkAlpha = new Float32Array(MAX_SPARKS);
  const sparkSize = new Float32Array(MAX_SPARKS);
  const sparkState = Array.from({ length: MAX_SPARKS }, () => ({
    alive: false,
    x: 0,
    y: -999,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    duration: 0.4,
  }));
  let sparkCursor = 0;

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("aColor", new THREE.BufferAttribute(sparkCol, 3));
  sparkGeo.setAttribute("aAlpha", new THREE.BufferAttribute(sparkAlpha, 1));
  sparkGeo.setAttribute("aSize", new THREE.BufferAttribute(sparkSize, 1));

  const sparkMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aAlpha;
      attribute float aSize;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp((aSize * 58.0) / max(1.0, -mv.z), 2.0, 26.0) * uPixelRatio;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.01) discard;
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float glow = exp(-d * d * 18.0);
        gl_FragColor = vec4(vColor * (1.8 + glow * 2.2), glow * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  sparkPoints.renderOrder = 10;
  scene.add(sparkPoints);

  const tmpColor = new THREE.Color();

  function spawnShockwave(x, z, maxRadius, crimson = true) {
    const mat = createShockwaveMaterial(crimson);
    const mesh = new THREE.Mesh(shockwaveGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.09, z);
    mesh.renderOrder = 6;
    scene.add(mesh);
    shockwaves.push({ mesh, mat, age: 0, duration: 0.62, maxRadius });
  }

  function spawnPhase2Pillar(x, z) {
    const outerMat = createPillarVortexMaterial();
    const outer = new THREE.Mesh(pillarOuterGeo, outerMat);
    outer.position.set(x, 11, z);
    outer.renderOrder = 7;
    scene.add(outer);

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x0b0205,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const core = new THREE.Mesh(pillarCoreGeo, coreMat);
    core.position.set(x, 11, z);
    scene.add(core);

    pillars.push({ outer, outerMat, core, coreMat, age: 0, duration: 1.35 });
    spawnShockwave(x, z, 9.5, true);
    spawnShockwave(x, z, 15.5, true);
    spawnSparks(x, 2.2, z, 0xff2233, 46);
    spawnSparks(x, 3.6, z, 0xffaa44, 24);
  }

  function spawnSparks(x, y, z, colorHex, count = 16) {
    tmpColor.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const idx = sparkCursor;
      sparkCursor = (sparkCursor + 1) % MAX_SPARKS;
      const sp = sparkState[idx];
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.8 + Math.random() * 7.8;
      sp.alive = true;
      sp.x = x + (Math.random() - 0.5) * 0.35;
      sp.y = y + (Math.random() - 0.5) * 0.35;
      sp.z = z + (Math.random() - 0.5) * 0.35;
      sp.vx = Math.cos(ang) * spd;
      sp.vy = 2.2 + Math.random() * 5.8;
      sp.vz = Math.sin(ang) * spd;
      sp.age = 0;
      sp.duration = 0.32 + Math.random() * 0.34;

      sparkCol[idx * 3] = tmpColor.r;
      sparkCol[idx * 3 + 1] = tmpColor.g;
      sparkCol[idx * 3 + 2] = tmpColor.b;
      sparkSize[idx] = 0.5 + Math.random() * 0.9;
    }
    sparkGeo.attributes.aColor.needsUpdate = true;
    sparkGeo.attributes.aSize.needsUpdate = true;
  }

  function syncProjectiles(projectiles, dt) {
    const activeIds = new Set(projectiles.map((p) => p.id));
    for (const [id, mesh] of projectileMeshes.entries()) {
      if (!activeIds.has(id)) {
        scene.remove(mesh);
        mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material && child.material !== waveMat) child.material.dispose();
        });
        projectileMeshes.delete(id);
      }
    }

    for (const p of projectiles) {
      let mesh = projectileMeshes.get(p.id);
      if (!mesh) {
        const group = new THREE.Group();
        // Sweeping crimson crescent wave
        const arcGeo = new THREE.TorusGeometry(1.55, 0.22, 10, 28, Math.PI * 0.92);
        const arc = new THREE.Mesh(arcGeo, waveMat);
        arc.rotation.z = Math.PI * 0.04;
        group.add(arc);

        // Dark obsidian black-flame spine inside the crescent
        const coreGeo = new THREE.TorusGeometry(1.52, 0.09, 8, 22, Math.PI * 0.85);
        const core = new THREE.Mesh(
          coreGeo,
          new THREE.MeshBasicMaterial({ color: 0x0b0205 })
        );
        core.rotation.z = Math.PI * 0.08;
        group.add(core);

        const light = new THREE.PointLight(0xff1a2b, 4.8, 10);
        group.add(light);

        scene.add(group);
        mesh = group;
        projectileMeshes.set(p.id, mesh);
      }
      mesh.position.set(p.x, 1.65, p.z);
      mesh.rotation.y = p.yaw;
      if (Math.random() < dt * 28) {
        spawnSparks(p.x, 1.5, p.z, 0xff1e2d, 1);
      }
    }
  }

  function update(dt, projectiles) {
    elapsed += dt;
    waveMat.uniforms.uTime.value = elapsed;
    syncProjectiles(projectiles, dt);

    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.age += dt;
      const t = s.age / s.duration;
      if (t >= 1) {
        scene.remove(s.mesh);
        s.mat.dispose();
        shockwaves.splice(i, 1);
      } else {
        const ease = 1 - Math.pow(1 - t, 2.2);
        const scale = 0.6 + ease * s.maxRadius;
        s.mesh.scale.set(scale, scale, 1);
        s.mat.uniforms.uProgress.value = t;
      }
    }

    for (let i = pillars.length - 1; i >= 0; i--) {
      const p = pillars[i];
      p.age += dt;
      const t = p.age / p.duration;
      if (t >= 1) {
        scene.remove(p.outer);
        scene.remove(p.core);
        p.outerMat.dispose();
        p.coreMat.dispose();
        pillars.splice(i, 1);
      } else {
        const expand = 1 + t * 2.2;
        p.outer.scale.set(expand, 1, expand);
        p.outerMat.uniforms.uTime.value = elapsed;
        p.outerMat.uniforms.uProgress.value = t;
        p.core.scale.set(1 + t * 1.4, 1, 1 + t * 1.4);
        p.coreMat.opacity = (1 - t) * 0.85;
      }
    }

    let anySpark = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const sp = sparkState[i];
      if (!sp.alive) {
        sparkAlpha[i] = 0;
        continue;
      }
      sp.age += dt;
      const t = sp.age / sp.duration;
      if (t >= 1) {
        sp.alive = false;
        sparkAlpha[i] = 0;
        sparkPos[i * 3 + 1] = -999;
      } else {
        anySpark = true;
        sp.vy -= 14.5 * dt;
        sp.x += sp.vx * dt;
        sp.y = Math.max(0.06, sp.y + sp.vy * dt);
        sp.z += sp.vz * dt;
        sparkPos[i * 3] = sp.x;
        sparkPos[i * 3 + 1] = sp.y;
        sparkPos[i * 3 + 2] = sp.z;
        sparkAlpha[i] = 1 - t;
      }
    }
    if (anySpark || true) {
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.aAlpha.needsUpdate = true;
    }
  }

  function clear() {
    for (const s of shockwaves) {
      scene.remove(s.mesh);
      s.mat.dispose();
    }
    shockwaves.length = 0;
    for (const p of pillars) {
      scene.remove(p.outer);
      scene.remove(p.core);
      p.outerMat.dispose();
      p.coreMat.dispose();
    }
    pillars.length = 0;
    for (const m of projectileMeshes.values()) {
      scene.remove(m);
      m.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material && child.material !== waveMat) child.material.dispose();
      });
    }
    projectileMeshes.clear();
    for (let i = 0; i < MAX_SPARKS; i++) {
      sparkState[i].alive = false;
      sparkAlpha[i] = 0;
      sparkPos[i * 3 + 1] = -999;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.aAlpha.needsUpdate = true;
  }

  return {
    spawnShockwave,
    spawnPhase2Pillar,
    spawnSparks,
    setPixelRatio(dpr) {
      sparkMat.uniforms.uPixelRatio.value = dpr;
    },
    update,
    clear,
  };
}
