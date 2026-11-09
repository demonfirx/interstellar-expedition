import * as THREE from "three";

const reflectionVertex = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  void main(){
    vUv=uv;
    vec4 world=modelMatrix*vec4(position,1.);
    vWorldPosition=world.xyz;
    vTangent=normalize(mat3(modelMatrix)*vec3(1.,0.,0.));
    vBitangent=normalize(mat3(modelMatrix)*vec3(0.,1.,0.));
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;
const reflectionFragment = `
  uniform sampler2D uSource;
  uniform float uReady;
  uniform float uTime;
  uniform float uGain;
  uniform float uApproachZoom;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  void main(){
    if(uReady<.5)discard;
    vec2 pixelUv=(floor(vUv*vec2(20.,14.))+.5)/vec2(20.,14.);
    vec3 view=normalize(cameraPosition-vWorldPosition);
    vec2 angle=vec2(dot(view,vTangent),dot(view,vBitangent));
    vec2 uv=vec2(.626,.47)+(pixelUv-.5)*vec2(.77,.78)+angle*vec2(.10,.065);
    uv+=vec2(sin(uTime*.35+pixelUv.y*5.)*.006,sin(uTime*.26+pixelUv.x*7.)*.004);
    uv=vec2(.626,.442)+(uv-vec2(.626,.442))/uApproachZoom;
    vec3 reflection=texture2D(uSource,clamp(uv,.001,.999)).rgb;
    float light=dot(reflection,vec3(.2126,.7152,.0722));
    float edge=1.-smoothstep(.44,.5,max(abs(vUv.x-.5),abs(vUv.y-.5)));
    vec3 halo=(texture2D(uSource,clamp(uv+vec2(.012,0.),.001,.999)).rgb+texture2D(uSource,clamp(uv-vec2(.012,0.),.001,.999)).rgb+texture2D(uSource,clamp(uv+vec2(0.,.018),.001,.999)).rgb+texture2D(uSource,clamp(uv-vec2(0.,.018),.001,.999)).rgb)*.25;
    reflection+=max(halo-.1,0.)*.075*(1.-smoothstep(.18,.8,light));
    float alpha=smoothstep(.018,.38,light)*edge*.34*uGain;
    gl_FragColor=vec4(reflection*.85,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Prefiltered accretion light and restrained, glowing reflections on cabin glass. */
export function createAccretionLighting({ scene, renderer, vessel }) {
  const surfaces = vessel.materials.filter(
    (surface) => surface.isMeshStandardMaterial,
  );
  const baseStrength = surfaces.map((surface) => surface.envMapIntensity);
  const coolBase = new THREE.Color("#a8baff"),
    coolNear = new THREE.Color("#c2c7ff");
  const warmBase = new THREE.Color("#e9b4ca"),
    warmNear = new THREE.Color("#efb7b0");
  const rim = new THREE.DirectionalLight("#aebeff", 3.9);
  rim.position.set(5, 2, -5);
  scene.add(rim);
  scene.add(rim.target);
  const cool = new THREE.PointLight("#a8baff", 16, 24, 2);
  const warm = new THREE.PointLight("#e9b4ca", 9, 20, 2);
  scene.add(cool, warm);
  const material = new THREE.ShaderMaterial({
    name: "Accretion_Cabin_Reflection",
    vertexShader: reflectionVertex,
    fragmentShader: reflectionFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSource: { value: null },
      uReady: { value: 0 },
      uTime: { value: 0 },
      uGain: { value: 0.62 },
      uApproachZoom: { value: 1 },
    },
  });
  for (const window of vessel.reflectors) {
    const reflection = new THREE.Mesh(
      new THREE.PlaneGeometry(window.width, window.height),
      material,
    );
    reflection.name = "Cabin_Accretion_Reflection";
    reflection.position.set(...window.position);
    reflection.rotation.y = window.rotationY;
    reflection.renderOrder = 2;
    vessel.root.add(reflection);
  }
  let environment;
  return {
    setSource(texture) {
      material.uniforms.uSource.value = texture;
      material.uniforms.uReady.value = 1;
      const generator = new THREE.PMREMGenerator(renderer);
      try {
        environment = generator.fromEquirectangular(texture);
        scene.environment = environment.texture;
        for (const surface of surfaces) {
          surface.envMap = environment.texture;
          surface.needsUpdate = true;
        }
      } finally {
        generator.dispose();
      }
    },
    update(time, aspect, approach) {
      const pulse =
        1 + 0.045 * Math.sin(time * 0.35) + 0.025 * Math.sin(time * 0.19 + 1.1);
      const position = vessel.root.position,
        forwardX = Math.cos(vessel.root.rotation.y),
        forwardZ = -Math.sin(vessel.root.rotation.y),
        sideX = -forwardZ,
        sideZ = forwardX;
      rim.position.set(
        position.x + forwardX * 6 + sideX * 2,
        position.y + 3.3,
        position.z + forwardZ * 6 + sideZ * 2,
      );
      rim.target.position.set(position.x, position.y + 0.6, position.z);
      rim.intensity = 3.9 * pulse * approach.lightGain;
      cool.position.set(
        position.x + forwardX * 4 + sideX * 2,
        position.y + 2.5,
        position.z + forwardZ * 4 + sideZ * 2,
      );
      cool.color.copy(coolBase).lerp(coolNear, approach.envelope * 0.5);
      cool.intensity = 16 * pulse * approach.lightGain;
      warm.position.set(
        position.x + forwardX * 3 - sideX * 0.5,
        position.y + 1,
        position.z + forwardZ * 3 - sideZ * 0.5,
      );
      warm.color.copy(warmBase).lerp(warmNear, approach.envelope * 0.45);
      warm.intensity =
        9 *
        (1 + 0.045 * Math.sin(time * 0.26 + 0.7)) *
        (1 + 0.25 * approach.envelope);
      scene.environmentIntensity = 0.9 + 0.035 * Math.sin(time * 0.23);
      scene.environmentRotation.set(
        0.015 * Math.sin(time * 0.15),
        -0.8 + vessel.root.rotation.y + 0.025 * Math.sin(time * 0.13),
        0,
      );
      material.uniforms.uTime.value = approach.flowTime;
      material.uniforms.uApproachZoom.value = approach.zoom;
      for (let i = 0; i < surfaces.length; i++) {
        surfaces[i].envMapIntensity =
          baseStrength[i] * pulse * (1 + 0.22 * approach.envelope);
        surfaces[i].envMapRotation.copy(scene.environmentRotation);
      }
      material.uniforms.uGain.value = 0.62 * pulse * approach.glowGain;
    },
    dispose() {
      if (environment) {
        for (const surface of surfaces)
          if (surface.envMap === environment.texture) surface.envMap = null;
        if (scene.environment === environment.texture) scene.environment = null;
        environment.dispose();
      }
      // The owning scene disposes the cabin reflection meshes with its other meshes.
    },
  };
}
