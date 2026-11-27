import * as THREE from 'three';

export function createArchiveSky(renderer) {
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: { uAspect: { value: 1 }, uFocus: { value: new THREE.Vector2(.5, .5) } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, .9999, 1.); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uAspect;
      uniform vec2 uFocus;
      float hash(vec2 p) {
        vec3 h = fract(vec3(p.xyx) * .1031);
        h += dot(h, h.yzx + 33.33);
        return fract((h.x + h.y) * h.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
          mix(hash(i + vec2(0,1)), hash(i + 1.), f.x), f.y);
      }
      float clouds(vec2 p) {
        return .52*noise(p) + .28*noise(p*2.07 + 2.0)
          + .13*noise(p*4.1 + 5.9) + .07*noise(p*8.3);
      }
      float stars(vec2 uv, float scale, float rarity) {
        vec2 cell = floor(uv * scale);
        vec2 offset = vec2(hash(cell + 7.), hash(cell + 21.)) * .66 + .17;
        float id = hash(cell);
        float d = length(fract(uv*scale) - offset);
        return step(rarity, id) * (1.-smoothstep(.01,.10,d)) * (.40 + id*.60);
      }
      void main() {
        vec2 p = (vUv-uFocus) * vec2(uAspect,1.);
        vec2 transformed = vec2(.92*p.x+.39*p.y, -.39*p.x+.92*p.y);
        float swirls = clouds(vec2(transformed.x*3.1, transformed.y*9.)
          + vec2(clouds(p*5.+8.)*2., clouds(p*2.+.2)));
        float band = exp(-abs(transformed.y+.035+sin(transformed.x*5.)*.03)*8.5);
        float dust = smoothstep(.32,.86,swirls) * band;
        float falloff = exp(-dot(p*vec2(1.4, 1.8),p*vec2(1.4, 1.8))*3.3);
        float warmth = smoothstep(-.09,.62,transformed.x+.17);
        vec3 fog = mix(vec3(.058,.112,.163), vec3(.152,.078,.046), warmth);
        vec3 color = vec3(.0022,.0037,.0068) + fog * (.16 * falloff + dust*.41) * falloff;
        vec2 starUv = vUv * vec2(uAspect,1.);
        float lights = stars(starUv, 107., .980) * .16 + stars(starUv+2., 221., .916) * .028;
        color += lights * mix(vec3(.69,.85,1.), vec3(1.,.74,.55), warmth);
        color += (hash(gl_FragCoord.xy)-.5)*.0009;
        gl_FragColor = vec4(color,1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const generator = new THREE.Scene();
  const camera = new THREE.Camera();
  const source = new THREE.Mesh(geometry, material);
  source.frustumCulled = false;
  generator.add(source);
  const plate = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
  });
  const sky = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: { uSky: { value: plate.texture } },
    vertexShader: material.vertexShader,
    fragmentShader: `
      uniform sampler2D uSky;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(uSky,vUv);
        #include <colorspace_fragment>
      }
    `,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  return {
    sky,
    resize(width, height, focusX, focusY) {
      material.uniforms.uAspect.value = width / height;
      material.uniforms.uFocus.value.set(focusX / width, 1 - focusY / height);
      const scale = Math.min(1, 1150 / Math.max(width, height));
      plate.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(plate);
      renderer.render(generator, camera);
      renderer.setRenderTarget(previousTarget);
    },
    dispose() {
      plate.dispose();
      material.dispose();
    },
  };
}

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
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      varying vec2 vPosition;
      uniform float uTime;
      void main() {
        float r = length(vPosition), a = atan(vPosition.y,vPosition.x);
        float fast = a - uTime * .20;
        float turbulence = sin(fast*7.+r*21.)*.024+sin(a*19.-r*48.+uTime)*.013;
        float lanes = .44 + .36*sin((r+turbulence)*53. + fast*4.)
          + .13*sin(r*121.+fast*13.) + .07*sin(r*217.-fast*7.);
        float edgeDistance = (r-1.04)*17.;
        float innerEdge = exp(-edgeDistance*edgeDistance);
        float outer = smoothstep(.91,1.03,r) * (1.-smoothstep(1.26,2.95,r));
        float hot = clamp(innerEdge + (1.-smoothstep(1.08,1.55,r))*.58,0.,1.);
        vec3 glow = mix(vec3(.44,.067,.017),vec3(1.0,.63,.27),hot);
        float litSide = .55 + .45 * sin(a+.42);
        gl_FragColor = vec4(glow*(.65+litSide*1.8+innerEdge*1.75),
          clamp(outer*lanes*(.37+.5*litSide)+innerEdge*.68,0.,.98));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

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
    uniforms: { uMix: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: `
      attribute vec3 aTarget;
      attribute float aSeed;
      varying float vSeed;
      uniform float uMix, uPixelRatio;
      void main() {
        vSeed = aSeed;
        float t = smoothstep(aSeed*.18, .79+aSeed*.2, uMix);
        float lift = sin(t*3.14159);
        vec3 p = mix(position, aTarget, t);
        p += lift * vec3(cos(aSeed*187.),sin(aSeed*273.),sin(aSeed*218.)) * (.32+aSeed*.7);
        vec4 view = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = clamp((11.+8.*aSeed) / -view.z, .9, 3.1) * uPixelRatio;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float vSeed;
      uniform float uOpacity;
      void main() {
        float edge = 1.-smoothstep(.07,.5,length(gl_PointCoord-.5));
        vec3 color = mix(vec3(.13,.65,1.),vec3(1.3,.55,.18),smoothstep(.39,.81,vSeed));
        gl_FragColor = vec4(color, edge * uOpacity * (.37+.63*vSeed));
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
    setClouds(start, end) {
      from.array.set(start);
      to.array.set(end);
      from.needsUpdate = to.needsUpdate = true;
    },
    draw(progress, opacity) {
      material.uniforms.uMix.value = progress;
      material.uniforms.uOpacity.value = opacity;
      points.visible = opacity > 0;
    },
    resize(dpr) { material.uniforms.uPixelRatio.value = dpr; },
  };
}
