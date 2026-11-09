import * as THREE from "three";
import { SEA_LEVEL } from "../models/sea-motion.js";

export function createCosmicOcean(scene) {
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
    },
    vertexShader: `
      uniform float uTime; varying vec3 vWorld;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        world.y+=.04*sin(world.x*.9+world.z*.32-uTime*.5)+.022*sin(world.z*.8-world.x*.21+uTime*.4);
        vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uImage; uniform float uReady;
      uniform vec2 uResolution; uniform vec2 uVessel; uniform float uHeading;
      varying vec3 vWorld;
      void main(){
        vec2 screen=gl_FragCoord.xy/uResolution;
        float aspect=uResolution.x/uResolution.y;
        vec2 fit=vec2(min(1.,aspect/1.77777778),min(1.,1.77777778/aspect));
        vec2 uv=(screen-.5)*fit+vec2(mix(.5,.615,1.-smoothstep(.75,1.4,aspect)),.5);
        uv.y=.515-abs(uv.y-.515)*.78;
        float ripple=sin(vWorld.x*2.8+vWorld.z*1.15-uTime*.7)*.0024+sin(vWorld.z*4.-uTime*.4)*.0015;
        uv+=vec2(ripple,ripple*.45);
        vec3 reflection=texture2D(uImage,clamp(uv,.001,.999)).rgb*uReady;
        vec2 rel=mat2(cos(uHeading),sin(uHeading),-sin(uHeading),cos(uHeading))*(vWorld.xz-uVessel);
        float behind=-rel.x;
        float trail=smoothstep(.75,1.1,behind)*(1.-smoothstep(1.5,3.8,behind));
        float wing=abs(abs(rel.y)-max(0.,behind-.75)*.2);
        float wake=exp(-wing*wing/(.003+behind*behind*.002))*trail;
        wake*=.65+.35*sin(behind*8.-uTime*.75);
        float shadow=exp(-dot(rel/vec2(1.15,.38),rel/vec2(1.15,.38))*2.);
        float rippleA=sin(vWorld.x*3.1+vWorld.z*2.7-uTime*.65+.65*sin(vWorld.x*.8-vWorld.z*.4));
        float rippleB=sin(-vWorld.x*2.3+vWorld.z*4.9+uTime*.35+.45*sin(vWorld.z*.9+vWorld.x*.6));
        vec3 normal=normalize(vec3(rippleA*.07,1.,rippleB*.055));
        vec3 eye=normalize(cameraPosition-vWorld);
        vec3 lightDirection=normalize(vec3(2.5,3.2,-8.)-vWorld);
        float glint=pow(max(dot(normal,normalize(eye+lightDirection)),0.),70.);
        float brokenCrest=pow(.5+.5*sin(vWorld.z*6.+vWorld.x*2.2+.65*sin(vWorld.x*1.4+vWorld.z*.3)-uTime*.55),18.);
        brokenCrest*=pow(.5+.5*sin(vWorld.x*7.7+vWorld.z*3.1+sin(vWorld.x*1.7+vWorld.z*2.8)),5.);
        vec3 col=(vec3(.008,.014,.036)+reflection*.34+vec3(.012,.017,.033)*brokenCrest+vec3(.045,.055,.09)*glint)*(1.-shadow*.46);
        col+=vec3(.11,.15,.25)*wake*.45;
        float distanceFade=1.-smoothstep(18.,45.,length(vWorld.xz));
        gl_FragColor=vec4(col,.42*distanceFade);
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
  return {
    setSource(texture) {
      material.uniforms.uImage.value = texture;
      material.uniforms.uReady.value = 1;
    },
    update(time, x, z, heading, renderer) {
      material.uniforms.uTime.value = time;
      material.uniforms.uVessel.value.set(x, z);
      material.uniforms.uHeading.value = heading;
      renderer.getDrawingBufferSize(material.uniforms.uResolution.value);
    },
  };
}
