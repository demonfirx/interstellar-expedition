import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { SEA_LEVEL } from "../models/sea-motion.js";

/** A low-resolution mirrored camera renders only the live vessel, never the ocean or sky. */
export function createVesselReflection(scene, vessel, oceanMesh, uniforms) {
  vessel.root.traverse((object) => {
    if (object.isMesh) object.layers.enable(1);
  });
  scene.traverse((object) => {
    if (object.isLight) object.layers.enable(1);
  });
  const reflector = new Reflector(new THREE.PlaneGeometry(1, 1), {
    textureWidth: 512,
    textureHeight: 512,
    multisample: 0,
    clipBias: 0.002,
  });
  reflector.name = "Vessel_Planar_Reflection";
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = SEA_LEVEL;
  reflector.updateMatrixWorld(true);
  reflector.camera.layers.set(1);
  const inverse = reflector.matrixWorld.clone().invert(),
    lastCamera = new THREE.Matrix4(),
    lastProjection = new THREE.Matrix4(),
    lastVessel = new THREE.Matrix4();
  let lastTime = -Infinity;
  uniforms.uVesselReflection.value = reflector.getRenderTarget().texture;
  oceanMesh.onBeforeRender = (renderer, renderScene, camera) => {
    if (
      lastTime !== uniforms.uTime.value ||
      !lastCamera.equals(camera.matrixWorld) ||
      !lastProjection.equals(camera.projectionMatrix) ||
      !lastVessel.equals(vessel.root.matrixWorld)
    ) {
      reflector.onBeforeRender(renderer, renderScene, camera);
      uniforms.uReflectionMatrix.value
        .copy(reflector.material.uniforms.textureMatrix.value)
        .multiply(inverse);
      lastTime = uniforms.uTime.value;
      lastCamera.copy(camera.matrixWorld);
      lastProjection.copy(camera.projectionMatrix);
      lastVessel.copy(vessel.root.matrixWorld);
    }
  };
  return {
    invalidate() {
      lastTime = -Infinity;
    },
    dispose() {
      oceanMesh.onBeforeRender = () => {};
      reflector.dispose();
      reflector.geometry.dispose();
    },
  };
}
