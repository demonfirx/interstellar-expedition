import * as THREE from 'three';

/**
 * Cosmic backdrop: bakes the expensive multi-octave nebula & starfield into a
 * cached plate on resize, then composites live per-specimen atmosphere, subtle
 * cursor light shift, and focus glide cheaply every frame.
 */
export function createArchiveSky(renderer) {
  const plateMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: {
      uAspect: { value: 1 },
      uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uAspect;
      uniform vec2 uFocus;

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
        return 0.50 * noise(p)
          + 0.27 * noise(p * 2.09 + 1.7)
          + 0.14 * noise(p * 4.18 + 5.3)
          + 0.09 * noise(p * 8.42 + 2.1);
      }

      float starLayer(vec2 uv, float scale, float threshold, float size) {
        vec2 cell = floor(uv * scale);
        vec2 offset = vec2(hash(cell + 7.1), hash(cell + 23.4)) * 0.68 + 0.16;
        float id = hash(cell);
        float d = length(fract(uv * scale) - offset);
        float core = 1.0 - smoothstep(0.008, size, d);
        return step(threshold, id) * core * (0.38 + id * 0.62);
      }

      void main() {
        vec2 p = (vUv - vec2(0.54, 0.5)) * vec2(uAspect, 1.0);
        vec2 rot = vec2(0.91 * p.x + 0.41 * p.y, -0.41 * p.x + 0.91 * p.y);
        float warpA = fbm(p * 3.8 + 4.2);
        float warpB = fbm(p * 1.9 - 1.4);
        float clouds = fbm(vec2(rot.x * 2.7, rot.y * 7.2) + vec2(warpA * 1.6, warpB * 0.9));
        float band = exp(-abs(rot.y + 0.02 + sin(rot.x * 4.2) * 0.035) * 7.4);
        float dust = smoothstep(0.30, 0.86, clouds) * band;

        vec2 starUv = vUv * vec2(uAspect, 1.0);
        float starsBright = starLayer(starUv, 92.0, 0.986, 0.095);
        float starsMid = starLayer(starUv + 3.7, 178.0, 0.958, 0.085);
        float starsFine = starLayer(starUv + 9.2, 310.0, 0.905, 0.075);
        float starMask = starsBright * 0.24 + starsMid * 0.085 + starsFine * 0.028;

        // Pack dust, warmth gradient, and star intensity cleanly into channels
        float warmth = smoothstep(-0.35, 0.65, rot.x + 0.12);
        gl_FragColor = vec4(dust, warmth, starMask, 1.0);
      }
    `,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const generator = new THREE.Scene();
  const camera = new THREE.Camera();
  const source = new THREE.Mesh(geometry, plateMaterial);
  source.frustumCulled = false;
  generator.add(source);

  const plate = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    type: renderer.extensions.has('EXT_color_buffer_float')
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType,
  });

  const displayMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: {
      uSky: { value: plate.texture },
      uAspect: { value: 1 },
      uFocus: { value: new THREE.Vector2(0.64, 0.52) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uCoolColor: { value: new THREE.Color('#132438') },
      uWarmColor: { value: new THREE.Color('#2a170c') },
      uGlowStrength: { value: 1.0 },
    },
    vertexShader: plateMaterial.vertexShader,
    fragmentShader: `
      uniform sampler2D uSky;
      uniform float uAspect;
      uniform vec2 uFocus;
      uniform vec2 uPointer;
      uniform float uTime;
      uniform vec3 uCoolColor;
      uniform vec3 uWarmColor;
      uniform float uGlowStrength;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 parallaxUv = clamp(vUv - uPointer * 0.008, 0.001, 0.999);
        vec3 baked = texture2D(uSky, parallaxUv).rgb;
        float dust = baked.r;
        float warmth = baked.g;
        float stars = baked.b;

        vec2 p = (vUv - uFocus) * vec2(uAspect, 1.0);
        float distSq = dot(p * vec2(1.18, 1.48), p * vec2(1.18, 1.48));
        float halo = exp(-distSq * 2.55);
        float innerAura = exp(-dot(p, p) * 6.2);

        // Deep obsidian celestial floor
        vec3 base = vec3(0.0020, 0.0034, 0.0064);
        vec3 nebula = mix(uCoolColor, uWarmColor, clamp(warmth + p.x * 0.25, 0.0, 1.0));
        vec3 color = base
          + nebula * (0.20 * halo + dust * 0.56 * (0.35 + 0.65 * halo)) * uGlowStrength
          + mix(uCoolColor, uWarmColor, 0.58) * innerAura * 0.14 * uGlowStrength;

        // Subtle starlight shimmer
        float twinkle = 0.88 + 0.12 * sin(uTime * 1.15 + vUv.x * 41.0 + vUv.y * 29.0);
        vec3 starTint = mix(vec3(0.74, 0.87, 1.0), vec3(1.0, 0.81, 0.64), warmth);
        color += stars * twinkle * starTint * (0.85 + 0.35 * (1.0 - halo));

        // Gentle outer architectural vignette
        float vig = 1.0 - smoothstep(0.45, 1.25, length((vUv - 0.5) * vec2(1.05, 1.15))) * 0.32;
        color *= vig;

        // Micro-dither eliminates 8-bit dark banding
        color += (hash(gl_FragCoord.xy) - 0.5) * 0.0012;

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const sky = new THREE.Mesh(geometry, displayMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -100;

  return {
    sky,
    uniforms: displayMaterial.uniforms,
    resize(width, height, focusX, focusY) {
      const aspect = width / height;
      plateMaterial.uniforms.uAspect.value = aspect;
      plateMaterial.uniforms.uFocus.value.set(focusX / width, 1 - focusY / height);
      displayMaterial.uniforms.uAspect.value = aspect;
      displayMaterial.uniforms.uFocus.value.set(focusX / width, 1 - focusY / height);
      const scale = Math.min(1, 720 / Math.max(width, height));
      plate.setSize(
        Math.max(1, Math.round(width * scale)),
        Math.max(1, Math.round(height * scale)),
      );
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(plate);
      renderer.render(generator, camera);
      renderer.setRenderTarget(previousTarget);
    },
    setFocus(nx, ny) {
      displayMaterial.uniforms.uFocus.value.set(nx, ny);
    },
    dispose() {
      plate.dispose();
      plateMaterial.dispose();
      displayMaterial.dispose();
      geometry.dispose();
    },
  };
}

/**
 * Relativistic equatorial accretion disk shader with organic sheared plasma
 * filaments, Keplerian differential velocity, and Doppler beaming asymmetry.
 */
export function createAccretionMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vPosition;
      void main() {
        vPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vPosition;
      uniform float uTime;

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

      // Seamless polar FBM along sheared orbital streamlines
      float plasma(float r, float a, float t) {
        float kepler = 1.65 / pow(max(r, 0.85), 1.35);
        float theta = a - t * 0.28 * kepler;
        vec2 cs1 = vec2(cos(theta * 2.0 + r * 5.0), sin(theta * 2.0 + r * 5.0));
        vec2 cs2 = vec2(cos(theta * 5.0 - r * 11.0), sin(theta * 5.0 - r * 11.0));
        float n1 = noise(vec2(r * 7.5, 0.0) + cs1 * 1.45);
        float n2 = noise(vec2(r * 16.0, 2.4) + cs2 * 1.9);
        float n3 = noise(vec2(r * 31.0, 5.1) + cs1 * 3.1 - t * 0.15);
        return n1 * 0.52 + n2 * 0.31 + n3 * 0.17;
      }

      void main() {
        float r = length(vPosition);
        float a = atan(vPosition.y, vPosition.x);

        float outerFade = smoothstep(0.93, 1.03, r) * (1.0 - smoothstep(1.38, 3.02, r));
        if (outerFade <= 0.001) discard;

        float swirlA = plasma(r, a, uTime);
        float swirlB = plasma(r * 1.18 + 0.06, a + 1.4, uTime * 1.15);
        float filaments = smoothstep(0.22, 0.84, swirlA * 0.68 + swirlB * 0.32);

        // Fine luminous shearing lanes without artificial sine-striping
        float streaks = 0.62 + 0.38 * sin(r * 34.0 + swirlA * 9.5 - uTime * 0.55);

        // Incandescent ISCO photon edge
        float edgeDist = (r - 1.015) * 19.0;
        float innerEdge = exp(-edgeDist * edgeDist);

        // Relativistic Doppler beaming: approaching side hotter & brighter
        float doppler = 0.5 + 0.5 * cos(a + 2.35);
        float beam = 0.42 + 1.35 * pow(doppler, 1.35);

        float heat = clamp(innerEdge * 1.15 + (1.0 - smoothstep(1.02, 1.95, r)) * 0.55 + doppler * 0.24, 0.0, 1.0);

        vec3 ember = vec3(0.46, 0.09, 0.03);
        vec3 copper = vec3(1.08, 0.52, 0.19);
        vec3 whiteHot = vec3(1.42, 1.18, 0.95);
        vec3 blueShift = vec3(0.76, 0.92, 1.35);

        vec3 col = mix(ember, copper, smoothstep(0.05, 0.58, heat));
        col = mix(col, whiteHot, smoothstep(0.56, 0.96, heat));
        col = mix(col, blueShift, pow(doppler, 3.2) * (0.20 + innerEdge * 0.25));

        float intensity = (0.36 + filaments * 0.95) * streaks * beam + innerEdge * 1.65;
        float alpha = clamp(outerFade * (0.22 + filaments * 0.78) * (0.48 + 0.52 * doppler) + innerEdge * 0.72, 0.0, 0.98);

        gl_FragColor = vec4(col * intensity, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * View-aligned gravitational lensing halo for Event Horizon: renders the bent
 * upper & lower light arches, razor-thin Einstein photon ring, and subtle
 * violet-blue relativistic scatter from every 3D orbit angle.
 */
export function createLensingHaloMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uTilt: { value: -0.22 },
    },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vPos;
      uniform float uTime;
      uniform float uTilt;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float c = cos(uTilt);
        float s = sin(uTilt);
        vec2 p = vec2(c * vPos.x - s * vPos.y, s * vPos.x + c * vPos.y);
        float r = length(p);
        float a = atan(p.y, p.x);

        // Razor-thin Einstein photon ring hugging the black shadow sphere
        float ringD = (r - 0.945) * 76.0;
        float photonRing = exp(-ringD * ringD);

        // Upper gravitationally lensed arch (dominant) & subtle lower counter-arch
        float upperMask = smoothstep(-0.04, 0.42, p.y / max(r, 0.001));
        float lowerMask = smoothstep(0.02, 0.56, -p.y / max(r, 0.001));

        // Concentric sheared light ribbons curving over the shadow poles
        float shear = 0.68
          + 0.20 * sin(r * 38.0 - a * 3.0 + uTime * 0.48)
          + 0.12 * sin(r * 74.0 + a * 6.0 - uTime * 0.34);

        float upperInner = exp(-pow((r - 1.03) * 8.2, 2.0)) * upperMask * shear;
        float upperOuter = exp(-pow((r - 1.21) * 3.6, 2.0)) * upperMask * (0.48 + 0.52 * shear) * 0.46;
        float lowerArch = exp(-pow((r - 1.02) * 10.5, 2.0)) * lowerMask * shear * 0.52;

        // Relativistic Doppler asymmetry (approaching left limb brighter & bluer)
        float doppler = 0.55 + 0.65 * smoothstep(-0.85, 0.85, -p.x);

        // Subtle cool violet-blue coronal scatter echoing Gargantua reference
        float corona = exp(-pow(max(r - 0.95, 0.0) * 2.25, 1.55)) * smoothstep(0.89, 1.0, r) * 0.22;

        vec3 amberGold = vec3(1.08, 0.58, 0.22);
        vec3 champagne = vec3(1.28, 1.08, 0.88);
        vec3 blueShift = vec3(0.46, 0.66, 1.24);

        vec3 archCol = mix(amberGold, champagne, smoothstep(0.45, 1.15, doppler * (0.42 + upperInner)));
        archCol = mix(archCol, blueShift, pow(max(doppler - 0.5, 0.0), 2.1) * 0.36);

        vec3 col = archCol * (upperInner * 1.05 + upperOuter * 0.72 + lowerArch * 0.75) * doppler
          + mix(amberGold, champagne, 0.55) * photonRing * (0.58 + 0.38 * doppler)
          + blueShift * corona * 0.68;

        // Clean cut inside shadow core & smooth outer fade
        float outsideShadow = smoothstep(0.922, 0.946, r);
        float outerCut = 1.0 - smoothstep(1.90, 2.52, r);
        float alpha = clamp(
          (photonRing * 0.68 + upperInner * 0.66 + upperOuter * 0.38 + lowerArch * 0.42 + corona)
            * outsideShadow * outerCut,
          0.0,
          0.92
        );

        gl_FragColor = vec4(col * outsideShadow * outerCut, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Floating cosmic mirror-ripple plinth beneath Lumen Sailer.
 */
export function createCosmicPlinthMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vPos;
      uniform float uTime;

      void main() {
        // Elongate slightly along vessel bow-stern axis
        vec2 p = vec2(vPos.x * 0.78, vPos.y * 1.18);
        float r = length(p);
        float radialFade = 1.0 - smoothstep(0.65, 2.38, r);
        if (radialFade <= 0.001) discard;

        // Expanding concentric ripples + gentle hull wake interference
        float wave1 = sin(r * 13.5 - uTime * 1.45);
        float wave2 = sin(r * 24.0 - uTime * 2.1 + atan(p.y, p.x) * 2.0);
        float ripple = smoothstep(0.16, 0.90, 0.55 + 0.32 * wave1 + 0.13 * wave2);

        // Crisp concentric horizon calibration ring at outer wake boundary
        float wakeRing = exp(-pow((r - 1.56) * 20.0, 2.0)) * 0.62;
        float keelGlow = exp(-r * r * 1.45) * 0.44;

        // Warm subtle lantern reflection under stern/bow
        float lanternGlow = exp(-dot(vPos - vec2(1.18, 0.25), vPos - vec2(1.18, 0.25)) * 2.1) * 0.34
          + exp(-dot(vPos - vec2(-1.12, 0.22), vPos - vec2(-1.12, 0.22)) * 2.0) * 0.30;

        vec3 oceanBlue = vec3(0.36, 0.64, 0.98);
        vec3 lanternWarm = vec3(0.98, 0.74, 0.46);

        vec3 col = oceanBlue * (ripple * 0.38 + wakeRing + keelGlow) + lanternWarm * lanternGlow;
        float alpha = clamp((ripple * 0.32 + wakeRing * 0.78 + keelGlow + lanternGlow) * radialFade, 0.0, 0.80);

        gl_FragColor = vec4(col * radialFade, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Quiet 3D depth-layered ambient space dust around the exhibition stage.
 */
export function createStarDust(count = 160) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let seed = 9187;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const radius = 3.2 + rand() * 5.8;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.72;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 0.8;
    seeds[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uTint: { value: new THREE.Color('#c8d8f0') },
      uWarmTint: { value: new THREE.Color('#ffc38f') },
    },
    vertexShader: `
      attribute float aSeed;
      varying float vSeed;
      varying float vDepth;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vSeed = aSeed;
        vec3 p = position;
        float drift = uTime * (0.04 + aSeed * 0.05);
        p.y += sin(drift + aSeed * 19.0) * 0.14;
        p.x += cos(drift * 0.8 + aSeed * 13.0) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDepth = clamp((-mv.z - 4.0) / 14.0, 0.0, 1.0);
        gl_PointSize = clamp((9.0 + aSeed * 9.0) / max(-mv.z, 1.0), 1.0, 3.0) * uPixelRatio;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vSeed;
      varying float vDepth;
      uniform vec3 uTint;
      uniform vec3 uWarmTint;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float glow = 1.0 - smoothstep(0.05, 0.5, d);
        vec3 col = mix(uTint, uWarmTint, smoothstep(0.55, 0.95, vSeed));
        float alpha = glow * (0.14 + 0.24 * vSeed) * (1.0 - vDepth * 0.45);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    uniforms: material.uniforms,
    resize(dpr) {
      material.uniforms.uPixelRatio.value = dpr;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Vortex-kinematic point-cloud morph transition between 3D specimens.
 */
export function createHologram(count) {
  const geometry = new THREE.BufferGeometry();
  const from = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const to = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const seeds = Float32Array.from({ length: count }, (_, i) => (i * 0.61803398875) % 1);
  geometry.setAttribute('position', from);
  geometry.setAttribute('aTarget', to);
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMix: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
      uCoolColor: { value: new THREE.Color('#3ca8ff') },
      uWarmColor: { value: new THREE.Color('#ff9d5c') },
    },
    vertexShader: `
      attribute vec3 aTarget;
      attribute float aSeed;
      varying float vSeed;
      varying float vLift;
      uniform float uMix, uPixelRatio;

      void main() {
        vSeed = aSeed;
        float t = smoothstep(aSeed * 0.16, 0.80 + aSeed * 0.19, uMix);
        float lift = sin(t * 3.14159265);
        vLift = lift;

        vec3 p = mix(position, aTarget, t);

        // Cohesive orbital vortex swirl during mid-morph
        float swirlAngle = lift * (0.42 + aSeed * 0.78);
        float cs = cos(swirlAngle);
        float sn = sin(swirlAngle);
        p.xz = mat2(cs, -sn, sn, cs) * p.xz;

        p += lift * vec3(
          cos(aSeed * 187.0),
          sin(aSeed * 273.0) * 0.72,
          sin(aSeed * 218.0)
        ) * (0.26 + aSeed * 0.62);

        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((10.5 + 8.5 * aSeed + lift * 4.5) / max(-view.z, 1.0), 0.9, 3.4) * uPixelRatio;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float vSeed;
      varying float vLift;
      uniform float uOpacity;
      uniform vec3 uCoolColor;
      uniform vec3 uWarmColor;

      void main() {
        float edge = 1.0 - smoothstep(0.06, 0.5, length(gl_PointCoord - 0.5));
        vec3 color = mix(uCoolColor, uWarmColor, smoothstep(0.34, 0.84, vSeed));
        color *= 1.0 + vLift * 0.35;
        gl_FragColor = vec4(color, edge * uOpacity * (0.36 + 0.64 * vSeed));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;

  return {
    points,
    uniforms: material.uniforms,
    setClouds(start, end) {
      from.array.set(start);
      to.array.set(end);
      from.needsUpdate = to.needsUpdate = true;
    },
    draw(progress, opacity) {
      material.uniforms.uMix.value = progress;
      material.uniforms.uOpacity.value = opacity;
      points.visible = opacity > 0.001;
    },
    resize(dpr) {
      material.uniforms.uPixelRatio.value = dpr;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
