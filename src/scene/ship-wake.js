import * as THREE from "three";
import {
  SEA_LEVEL,
  sampleVoyagePosition,
  sampleSeaHeight,
} from "../models/sea-motion.js";

/** Three small ribbons follow previous stern positions instead of moving with the boat. */
export function createShipWake(scene) {
  const count = 18,
    ribbons = 3,
    positions = new Float32Array(count * ribbons * 2 * 3),
    uvs = [],
    strengths = [],
    indices = [];
  for (let r = 0; r < ribbons; r++) {
    for (let i = 0; i < count; i++)
      for (let side = 0; side < 2; side++) {
        uvs.push(side, i / (count - 1));
        strengths.push(r === 2 ? 0.42 : 1);
      }
    for (let i = 0; i < count - 1; i++) {
      const n = (r * count + i) * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute(
    "aFoam",
    new THREE.Float32BufferAttribute(strengths, 1),
  );
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uGain: { value: 1 } },
    vertexShader:
      "attribute float aFoam; varying vec2 vUv; varying float vFoam; void main(){vUv=uv;vFoam=aFoam;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
    uniform float uTime;uniform float uGain;varying vec2 vUv;varying float vFoam;
    void main(){float edge=smoothstep(0.,.32,vUv.x)*(1.-smoothstep(.68,1.,vUv.x));float fade=pow(1.-vUv.y,1.5);float ripple=.76+.24*sin(vUv.y*52.-uTime*.7);gl_FragColor=vec4(vec3(.42,.49,.62),edge*fade*ripple*vFoam*.32*uGain);
      #include <colorspace_fragment>
    }
  `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Voyage_Wake";
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const current = {},
    history = {};
  return {
    update(time, route, scale, approach) {
      material.uniforms.uTime.value = approach.waveTime;
      material.uniforms.uGain.value = approach.wakeGain;
      sampleVoyagePosition(time, route, current);
      let n = 0;
      for (let r = 0; r < ribbons; r++)
        for (let i = 0; i < count; i++) {
          const age = (i / (count - 1)) * 70;
          sampleVoyagePosition(time - age, route, history);
          const travelled = Math.hypot(
            current.x - history.x,
            current.z - history.z,
          );
          const normalX = -history.tangentZ,
            normalZ = history.tangentX;
          const spread =
            (0.22 * scale + 0.24 * travelled * (1 + 0.2 * approach.envelope)) *
            (r === 0 ? -1 : r === 1 ? 1 : 0);
          const width =
            (r === 2 ? 0.12 : 0.065) + Math.min(0.1, travelled * 0.02);
          const sternX = history.x - history.tangentX * 1.65 * scale,
            sternZ = history.z - history.tangentZ * 1.65 * scale;
          for (const side of [-1, 1]) {
            const x = sternX + normalX * (spread + side * width),
              z = sternZ + normalZ * (spread + side * width);
            positions[n++] = x;
            positions[n++] =
              SEA_LEVEL + sampleSeaHeight(x, z, time, approach) + 0.014;
            positions[n++] = z;
          }
        }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
