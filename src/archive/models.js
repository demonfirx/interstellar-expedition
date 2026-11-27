import * as THREE from 'three';
import { createSailingVessel } from '../models/sailing-vessel.js';
import { createAccretionMaterial } from './visuals.js';

const TAU = Math.PI * 2;

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}

function arcSegment(inner, outer, angle, depth, bevel) {
  const start = -angle / 2;
  const end = angle / 2;
  const shape = new THREE.Shape();
  shape.moveTo(outer * Math.cos(start), outer * Math.sin(start));
  shape.absarc(0, 0, outer, start, end, false);
  shape.lineTo(inner * Math.cos(end), inner * Math.sin(end));
  shape.absarc(0, 0, inner, end, start, true);
  shape.closePath();
  const segment = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: 24, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
  });
  segment.translate(0, 0, -depth / 2);
  return segment;
}

function ceramicCore() {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#a0b8d4', roughness: .34, metalness: .31,
    clearcoat: .76, clearcoatRoughness: .27, iridescence: .21,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vCore;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCore = normalize(position);');
    shader.fragmentShader = `
      varying vec3 vCore;
      float coreTrace(vec3 p) {
        float angle = atan(p.z,p.x);
        float wave = sin(p.y * 15. + 2.4*sin(angle*3. + p.y*8.) + 1.1*sin(angle*7.));
        float cracks = abs(wave+.17*sin(angle*21.+p.y*38.));
        return 1.-smoothstep(.02,.18,cracks);
      }
      ${shader.fragmentShader}`
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 core = normalize(vCore);
        float trace = coreTrace(core);
        float shade = .5+.5*sin(core.y*11.+2.1*sin(core.z*8.)+cos(core.x*10.));
        diffuseColor.rgb *= mix(vec3(.11,.24,.38), vec3(.53,.73,.92), shade);
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        totalEmissiveRadiance += trace*vec3(.08,.42,.65)*(.22+.63*shade);
      `);
  };
  return material;
}

function createTidalArray() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.name = 'Tidal_Array';
  root.add(body);
  body.rotation.set(.27, -.31, -.30);

  const titanium = new THREE.MeshPhysicalMaterial({ color: '#4a5665', metalness: .82, roughness: .36, clearcoat: .27 });
  const dark = new THREE.MeshStandardMaterial({ color: '#283744', metalness: .65, roughness: .43 });
  const steel = new THREE.MeshStandardMaterial({ color: '#a6b7c0', metalness: .77, roughness: .27 });
  const bronze = new THREE.MeshPhysicalMaterial({ color: '#c79564', metalness: .78, roughness: .31, clearcoat: .38 });
  const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, .98, .25) });
  const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(.22, 1.56, 3.5) });
  const rails = new THREE.TorusGeometry(2.07, .041, 10, 120);
  mesh(body, rails, steel, 0, 0, -.18);
  mesh(body, rails, bronze, 0, 0, .18);
  mesh(body, new THREE.TorusGeometry(1.86, .057, 12, 128), titanium);

  const housing = arcSegment(2.1, 2.36, .89, .25, .031);
  const panel = arcSegment(2.18, 2.34, .62, .048, .012);
  const recess = arcSegment(2.1, 2.28, .51, .025, .008);
  const amberStrip = arcSegment(2.225, 2.254, .43, .012, .003);
  const bridge = arcSegment(1.84, 2.15, .11, .3, .025);
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    mesh(body, housing, i % 3 === 1 ? dark : titanium).rotation.z = angle;
    mesh(body, panel, i % 3 === 1 ? steel : bronze, 0, 0, .185).rotation.z = angle;
    mesh(body, recess, dark, 0, 0, .222).rotation.z = angle;
    mesh(body, amberStrip, amber, 0, 0, .242).rotation.z = angle;
    mesh(body, bridge, steel).rotation.z = angle + .25;
  }

  const tickGeometry = new THREE.BoxGeometry(.047, .012, .013);
  const ticks = new THREE.InstancedMesh(tickGeometry, steel, 144);
  const stamp = new THREE.Object3D();
  for (let i = 0; i < ticks.count; i++) {
    const angle = i * TAU / ticks.count;
    stamp.position.set(1.972 * Math.cos(angle), 1.972 * Math.sin(angle), .186);
    stamp.rotation.z = angle;
    stamp.scale.x = i % 12 === 0 ? 2.1 : 1;
    stamp.updateMatrix();
    ticks.setMatrixAt(i, stamp.matrix);
  }
  body.add(ticks);

  const boltGeometry = new THREE.CylinderGeometry(.032, .032, .022, 6);
  boltGeometry.rotateX(Math.PI / 2);
  const bolts = new THREE.InstancedMesh(boltGeometry, steel, 24);
  for (let i = 0; i < bolts.count; i++) {
    const angle = Math.floor(i / 4) * TAU / 6 + (i % 4 < 2 ? -.342 : .342);
    const radius = i % 2 === 0 ? 2.18 : 2.30;
    stamp.position.set(radius * Math.cos(angle), radius * Math.sin(angle), .169);
    stamp.rotation.z = angle;
    stamp.scale.setScalar(1);
    stamp.updateMatrix();
    bolts.setMatrixAt(i, stamp.matrix);
  }
  body.add(bolts);

  const hinge = new THREE.Group();
  hinge.rotation.z = .30;
  body.add(hinge);
  const pin = new THREE.CylinderGeometry(.066, .066, .54, 18);
  const socket = new THREE.CylinderGeometry(.11, .11, .18, 18);
  for (const sign of [-1, 1]) {
    mesh(hinge, pin, steel, 0, sign * 1.81);
    mesh(hinge, socket, titanium, 0, sign * 2.01);
  }
  const gimbal = new THREE.Group();
  gimbal.rotation.y = .42;
  hinge.add(gimbal);
  mesh(gimbal, new THREE.TorusGeometry(1.54, .074, 12, 112), bronze);
  mesh(gimbal, new THREE.TorusGeometry(1.42, .023, 8, 104), steel, 0, 0, .06);
  const bearing = new THREE.SphereGeometry(.108, 16, 12);
  for (let i = 0; i < 4; i++) {
    const angle = i * TAU / 4 + .4;
    mesh(gimbal, arcSegment(1.38, 1.68, .21, .17, .02), titanium).rotation.z = angle;
    mesh(gimbal, bearing, steel, 1.53 * Math.cos(angle), 1.53 * Math.sin(angle), .11);
  }

  const cradle = new THREE.Group();
  cradle.rotation.set(-.54, -.58, .2);
  body.add(cradle);
  mesh(cradle, new THREE.TorusGeometry(1.13, .037, 12, 100), steel);
  mesh(cradle, new THREE.TorusGeometry(1.065, .013, 8, 100), blue, 0, 0, .033);
  const spurs = arcSegment(1.01, 1.23, .31, .116, .014);
  for (let i = 0; i < 3; i++) mesh(cradle, spurs, dark).rotation.z = i * TAU / 3;

  const core = mesh(body, new THREE.SphereGeometry(.79, 42, 28), ceramicCore());
  const collar = mesh(body, new THREE.TorusGeometry(.815, .015, 8, 96), bronze);
  collar.rotation.set(.86, .46, -.2);

  return {
    root, baseYaw: .05,
    update(time) {
      core.rotation.y = time * .21;
      gimbal.rotation.y = .42 + Math.sin(time * .42) * .18;
      cradle.rotation.x = -.54 + Math.sin(time * .61) * .22;
    },
  };
}

function createArchiveSailer() {
  const vessel = createSailingVessel();
  const root = new THREE.Group();
  root.name = 'Lumen_Sailer';
  vessel.root.position.set(0, -1.34, 0);
  root.add(vessel.root);
  for (const sail of vessel.sails) {
    const material = sail.mesh.material;
    material.color.set('#e3d9c2');
    material.roughness = .86;
    material.metalness = .06;
    material.envMapIntensity = .7;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `varying vec2 vWeave;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWeave = uv;');
      shader.fragmentShader = `varying vec2 vWeave;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', `
          #include <color_fragment>
          float seam = smoothstep(.025,.09,abs(fract(vWeave.y*7.)-.5));
          float hem = smoothstep(.0,.024,min(vWeave.x,1.-vWeave.x));
          diffuseColor.rgb *= mix(.59, .91+.09*seam, hem);
        `);
    };
  }
  return {
    root, baseYaw: -.40,
    update(time) { vessel.updateSails(time, .78); },
  };
}

function createEventHorizon() {
  const root = new THREE.Group();
  root.name = 'Event_Horizon';
  const diskMaterial = createAccretionMaterial();
  const tilt = new THREE.Group();
  tilt.rotation.set(1.21, 0, -.22);
  root.add(tilt);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: '#010205' });
  mesh(root, new THREE.SphereGeometry(.93, 48, 28), sphereMaterial);
  mesh(tilt, new THREE.RingGeometry(.96, 2.86, 128, 6), diskMaterial);

  const edge = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, .45, .092), transparent: true,
    opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = mesh(root, new THREE.TorusGeometry(.98, .015, 10, 132), edge);
  halo.rotation.set(-.12, .24, -.25);
  const bent = mesh(root, new THREE.TorusGeometry(1.02, .024, 10, 86, Math.PI * .89), edge);
  bent.scale.y = .91;
  bent.rotation.z = .16;

  return {
    root, baseYaw: -.08,
    update(time) {
      diskMaterial.uniforms.uTime.value = time;
      edge.opacity = .78 + Math.sin(time * .8) * .12;
    },
  };
}

export const createArchiveModels = [createTidalArray, createArchiveSailer, createEventHorizon];
