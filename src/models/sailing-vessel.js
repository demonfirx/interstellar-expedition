import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Original miniature sailboat, merged by material to keep the draw count small. */
export function createSailingVessel() {
  const root = new THREE.Group();
  root.name = "LUMEN_SAILER";
  const materials = [
    new THREE.MeshStandardMaterial({
      name: "Hull",
      vertexColors: true,
      roughness: 0.5,
      metalness: 0.18,
      envMapIntensity: 0.45,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      name: "Deck",
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.05,
      envMapIntensity: 0.25,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      name: "Fittings",
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.45,
      envMapIntensity: 0.6,
      flatShading: true,
    }),
    new THREE.MeshPhysicalMaterial({
      name: "Cabin_Glass",
      vertexColors: true,
      roughness: 0.22,
      metalness: 0.35,
      clearcoat: 0.75,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.25,
      emissive: "#53669a",
      emissiveIntensity: 0.12,
    }),
    new THREE.MeshBasicMaterial({ name: "Lanterns", vertexColors: true }),
    new THREE.MeshStandardMaterial({
      name: "Rigging",
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.1,
      envMapIntensity: 0.2,
    }),
  ];
  const bins = materials.map(() => []);
  function piece(geometry, index, color) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    const colors = [],
      c = new THREE.Color(color);
    for (let i = 0; i < g.attributes.position.count; i++)
      colors.push(c.r, c.g, c.b);
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    if (!g.attributes.uv)
      g.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Float32Array(g.attributes.position.count * 2),
          2,
        ),
      );
    bins[index].push(g);
  }
  function box(x, y, z, w, h, d, index, color) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    piece(g, index, color);
  }
  function beam(a, b, r, index, color) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      direction = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(r, r, direction.length(), 6, 1);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      ),
    );
    const middle = start.add(end).multiplyScalar(0.5);
    g.translate(middle.x, middle.y, middle.z);
    piece(g, index, color);
  }
  const stations = [
    [-1.8, 0.29],
    [-1.45, 0.59],
    [-0.65, 0.66],
    [0.55, 0.61],
    [1.35, 0.4],
    [1.88, 0.025],
  ];
  const hullVertices = [];
  const section = ([x, w]) => [
    [x, 0.2 + (x > 1.2 ? 0.1 : 0), w],
    [x, -0.19, w * 0.76],
    [x, -0.55, w * 0.1],
    [x, -0.19, -w * 0.76],
    [x, 0.2 + (x > 1.2 ? 0.1 : 0), -w],
  ];
  function triangle(a, b, c) {
    hullVertices.push(...a, ...b, ...c);
  }
  for (let i = 0; i < stations.length - 1; i++) {
    const a = section(stations[i]),
      b = section(stations[i + 1]);
    for (let j = 0; j < 4; j++) {
      triangle(a[j], b[j + 1], b[j]);
      triangle(a[j], a[j + 1], b[j + 1]);
    }
  }
  for (const [station, reverse] of [
    [stations[0], false],
    [stations.at(-1), true],
  ]) {
    const ring = section(station),
      center = [station[0], -0.04, 0];
    for (let i = 0; i < 5; i++)
      if (reverse) triangle(center, ring[(i + 1) % 5], ring[i]);
      else triangle(center, ring[i], ring[(i + 1) % 5]);
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(hullVertices, 3),
  );
  hull.computeVertexNormals();
  piece(hull, 0, "#344963");
  const deckShape = new THREE.Shape();
  const outline = [
    ...stations.map(([x, w]) => [x, w]),
    ...stations.toReversed().map(([x, w]) => [x, -w]),
  ];
  outline.forEach(([x, z], i) =>
    i ? deckShape.lineTo(x, z) : deckShape.moveTo(x, z),
  );
  deckShape.closePath();
  const deck = new THREE.ExtrudeGeometry(deckShape, {
    depth: 0.055,
    bevelEnabled: false,
  });
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, 0.2, 0);
  piece(deck, 1, "#837786");
  for (let i = 0; i < stations.length - 1; i++) {
    const [ax, aw] = stations[i],
      [bx, bw] = stations[i + 1];
    for (const side of [-1, 1]) {
      beam(
        [ax, 0.26, side * aw],
        [bx, 0.26 + (bx > 1.2 ? 0.1 : 0), side * bw],
        0.029,
        2,
        "#8e9db9",
      );
      beam(
        [ax, -0.1, side * aw * 0.9],
        [bx, -0.1, side * bw * 0.9],
        0.018,
        2,
        "#687d9f",
      );
    }
  }
  for (const x of [-1.35, -0.95, -0.55, -0.15, 0.25, 0.65, 1.05])
    box(x, 0.258, 0, 0.012, 0.008, x > 1 ? 0.65 : 1.0, 1, "#665f76");
  // Low cabin and its four small, reflective windows.
  box(-0.94, 0.43, 0, 0.96, 0.42, 0.75, 0, "#63758e");
  box(-0.94, 0.67, 0, 1.08, 0.09, 0.84, 2, "#33465f");
  const reflectors = [];
  for (const side of [-1, 1])
    for (const x of [-1.18, -0.73]) {
      box(x, 0.44, side * 0.39, 0.29, 0.23, 0.025, 3, "#7f96bf");
      reflectors.push({
        position: [x, 0.44, side * 0.409],
        rotationY: side === 1 ? 0 : Math.PI,
        width: 0.27,
        height: 0.21,
      });
    }
  // Mast, booms, stays, guardrails and stern rudder.
  beam([0.12, 0.23, 0], [0.12, 3.02, 0], 0.043, 2, "#99a6bc");
  beam([0.12, 0.91, 0], [-1.58, 0.91, 0], 0.027, 2, "#8796b1");
  beam([0.12, 2.88, 0], [1.85, 0.34, 0], 0.008, 5, "#a0abc6");
  for (const side of [-1, 1]) {
    beam([0.12, 2.82, 0], [-1.5, 0.29, side * 0.56], 0.008, 5, "#8e9bb7");
    for (const x of [-1.45, -0.45, 0.7, 1.32])
      beam([x, 0.26, side * 0.46], [x, 0.46, side * 0.46], 0.011, 2, "#7d8ca8");
    beam(
      [-1.45, 0.46, side * 0.46],
      [1.32, 0.46, side * 0.46],
      0.008,
      5,
      "#9ba8bf",
    );
  }
  box(-1.82, -0.19, 0, 0.09, 0.68, 0.12, 1, "#5d637d");
  box(1.47, 0.36, 0.28, 0.085, 0.1, 0.085, 4, "#91bfcf");
  box(-1.35, 0.75, 0.27, 0.065, 0.1, 0.065, 4, "#b7a492");
  const merged = bins.map((parts) => mergeGeometries(parts));
  const geometry = mergeGeometries(merged, true);
  bins.flat().forEach((g) => g.dispose());
  merged.forEach((g) => g.dispose());
  const body = new THREE.Mesh(geometry, materials);
  body.name = "Hull_Deck_and_Cabin";
  root.add(body);

  const sailMaterial = new THREE.MeshStandardMaterial({
    name: "Silver_Canvas",
    color: "#b4bed2",
    roughness: 0.91,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.15,
  });
  materials.push(sailMaterial);
  const sails = [];
  function sail(name, top, left, right, belly) {
    const positions = [],
      uvs = [],
      indices = [],
      steps = 9;
    for (let row = 0; row < steps; row++)
      for (let column = 0; column <= steps; column++) {
        const u = column / steps,
          v = row / steps;
        const x = (left[0] + (right[0] - left[0]) * u) * (1 - v) + top[0] * v;
        const y = (left[1] + (right[1] - left[1]) * u) * (1 - v) + top[1] * v;
        positions.push(
          x,
          y,
          0.035 + Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * belly,
        );
        uvs.push(u, v);
      }
    const apex = positions.length / 3;
    positions.push(top[0], top[1], 0.035);
    uvs.push(0.5, 1);
    for (let r = 0; r < steps - 1; r++)
      for (let c = 0; c < steps; c++) {
        const i = r * (steps + 1) + c;
        indices.push(
          i,
          i + 1,
          i + steps + 1,
          i + 1,
          i + steps + 2,
          i + steps + 1,
        );
      }
    for (let c = 0; c < steps; c++) {
      const i = (steps - 1) * (steps + 1) + c;
      indices.push(i, i + 1, apex);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, sailMaterial);
    mesh.name = name;
    root.add(mesh);
    sails.push({ mesh, rest: Float32Array.from(positions) });
  }
  sail("Main_Sail", [0.09, 2.9], [-1.58, 0.94], [0.09, 0.94], 0.14);
  sail("Jib_Sail", [0.24, 2.65], [0.24, 0.85], [1.76, 0.45], 0.095);
  root.userData = {
    artist: "Original procedural low-poly sailing vessel",
    bow: "+X",
    waterline: -0.2,
  };
  function updateSails(time, strength = 1) {
    for (let n = 0; n < sails.length; n++) {
      const { mesh, rest } = sails[n],
        position = mesh.geometry.attributes.position,
        uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < position.count; i++) {
        const u = uv.getX(i),
          v = uv.getY(i);
        position.setZ(
          i,
          rest[i * 3 + 2] +
            0.022 *
              strength *
              Math.sin(v * 6 + u * 2 - time * 0.95 + n) *
              Math.sin(Math.PI * u) *
              (1 - v),
        );
      }
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  }
  return { root, materials, reflectors, sails, updateSails };
}
