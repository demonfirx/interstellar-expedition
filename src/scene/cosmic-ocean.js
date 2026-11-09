import * as THREE from "three";
import { SEA_LEVEL } from "../models/sea-motion.js";
import { createVesselReflection } from "./vessel-reflection.js";

export function createCosmicOcean(scene, vessel) {
  const material = new THREE.ShaderMaterial({
    name: "Cosmic_Ocean",
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uImage: { value: null },
      uReady: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uVessel: { value: new THREE.Vector2() },
      uHeading: { value: 0 },
      uVesselReflection: { value: null },
      uReflectionMatrix: { value: new THREE.Matrix4() },
      uWaveAmplitude: { value: 1 },
      uApproachZoom: { value: 1 },
      uProximity: { value: 0 },
      uLightGain: { value: 1 },
      uCameraOffset: { value: new THREE.Vector2() },
      uCameraScale: { value: 1 },
    },
    vertexShader: `
      uniform float uTime;uniform float uWaveAmplitude;uniform mat4 uReflectionMatrix; varying vec3 vWorld;varying vec4 vReflection;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        world.y+=(.04*sin(world.x*.9+world.z*.32-uTime*.5)+.022*sin(world.z*.8-world.x*.21+uTime*.4))*uWaveAmplitude;
        vWorld=world.xyz;vReflection=uReflectionMatrix*vec4(world.x,${SEA_LEVEL},world.z,1.); gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uImage; uniform float uReady;
      uniform vec2 uResolution; uniform vec2 uVessel; uniform float uHeading;
      uniform sampler2D uVesselReflection;varying vec4 vReflection;varying vec3 vWorld;
      uniform float uWaveAmplitude;uniform float uApproachZoom;uniform float uProximity;uniform float uLightGain;uniform vec2 uCameraOffset;uniform float uCameraScale;
      void main(){
        vec2 screen=gl_FragCoord.xy/uResolution;
        float aspect=uResolution.x/uResolution.y;
        vec2 fit=vec2(min(1.,aspect/1.77777778),min(1.,1.77777778/aspect));
        vec2 uv=(screen-.5)*fit*.975*uCameraScale+vec2(mix(.5,.615,1.-smoothstep(.75,1.4,aspect)),.5)+uCameraOffset*fit;
        uv.y=.515-abs(uv.y-.515)*.78;
        uv=vec2(.626,.442)+(uv-vec2(.626,.442))/uApproachZoom;
        float ripple=(sin(vWorld.x*2.8+vWorld.z*1.15-uTime*.7)*.0024+sin(vWorld.z*4.-uTime*.4)*.0015)*uWaveAmplitude;
        uv+=vec2(ripple,ripple*.45);
        vec3 reflection=texture2D(uImage,clamp(uv,.001,.999)).rgb*uReady;
        vec2 rel=mat2(cos(uHeading),sin(uHeading),-sin(uHeading),cos(uHeading))*(vWorld.xz-uVessel);
        float shadow=exp(-dot(rel/vec2(1.15,.38),rel/vec2(1.15,.38))*2.);
        float rippleA=sin(vWorld.x*3.1+vWorld.z*2.7-uTime*.65+.65*sin(vWorld.x*.8-vWorld.z*.4));
        float rippleB=sin(-vWorld.x*2.3+vWorld.z*4.9+uTime*.35+.45*sin(vWorld.z*.9+vWorld.x*.6));
        vec3 normal=normalize(vec3(rippleA*.07*uWaveAmplitude,1.,rippleB*.055*uWaveAmplitude));
        vec3 eye=normalize(cameraPosition-vWorld);
        vec3 lightDirection=normalize(vec3(2.5,3.2,-8.)-vWorld);
        float glint=pow(max(dot(normal,normalize(eye+lightDirection)),0.),70.);
        float brokenCrest=pow(.5+.5*sin(vWorld.z*6.+vWorld.x*2.2+.65*sin(vWorld.x*1.4+vWorld.z*.3)-uTime*.55),18.);
        brokenCrest*=pow(.5+.5*sin(vWorld.x*7.7+vWorld.z*3.1+sin(vWorld.x*1.7+vWorld.z*2.8)),5.);
        vec3 col=(vec3(.008,.014,.036)+reflection*.34*uLightGain+vec3(.012,.017,.033)*brokenCrest+vec3(.045,.055,.09)*glint*uLightGain)*(1.-shadow*.46);
        col+=vec3(.03,.04,.075)*uProximity*smoothstep(7.,30.,length(rel))*.4;
        vec2 projected=vReflection.xy/vReflection.w;
        projected+=vec2(ripple*1.4,ripple*.32);
        vec4 ship=texture2D(uVesselReflection,clamp(projected,.001,.999))*.6;
        ship+=texture2D(uVesselReflection,clamp(projected+vec2(.0015*(1.+.55*uProximity),0.),.001,.999))*.2;
        ship+=texture2D(uVesselReflection,clamp(projected-vec2(.0015*(1.+.55*uProximity),0.),.001,.999))*.2;
        float reflectionFade=1.-smoothstep(3.,13.,length(rel));
        float reflectionWeight=ship.a*reflectionFade*.58;
        col=mix(col,ship.rgb*vec3(.5,.6,.78),reflectionWeight);
        float distanceFade=1.-smoothstep(18.,45.,length(vWorld.xz-uVessel));
        gl_FragColor=vec4(col,mix(.42,.74,reflectionWeight)*distanceFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(70, 80, 70, 80);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, SEA_LEVEL, -22);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Accretion_Ocean";
  mesh.renderOrder = -5;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const vesselReflection = createVesselReflection(
    scene,
    vessel,
    mesh,
    material.uniforms,
  );
  return {
    setSource(texture) {
      vesselReflection.invalidate();
      material.uniforms.uImage.value = texture;
      material.uniforms.uReady.value = 1;
    },
    update(time, x, z, heading, renderer, approach, background) {
      mesh.position.set(x, 0, z);
      material.uniforms.uTime.value = approach.waveTime;
      material.uniforms.uWaveAmplitude.value = approach.waveAmplitude;
      material.uniforms.uApproachZoom.value = approach.zoom;
      material.uniforms.uProximity.value = approach.envelope;
      material.uniforms.uLightGain.value = approach.lightGain;
      material.uniforms.uCameraOffset.value.set(background.x, background.y);
      material.uniforms.uCameraScale.value = background.scale;
      material.uniforms.uVessel.value.set(x, z);
      material.uniforms.uHeading.value = heading;
      renderer.getDrawingBufferSize(material.uniforms.uResolution.value);
    },
    dispose() {
      vesselReflection.dispose();
    },
  };
}
