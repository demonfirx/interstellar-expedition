import { Vector3 } from "three";

// Sample in the model's resting pose, giving large faces proportionally more points.
export function sampleSurface(model, count) {
  const triangles = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  let totalArea = 0;
  let seed = 173;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  model.updateWorldMatrix(true, true);
  model.traverse((mesh) => {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.skipHologram) return;
    const { index, attributes } = mesh.geometry;
    const { position } = attributes;
    const vertexAt = (i) => index ? index.getX(i) : i;
    for (let i = 0; i + 2 < (index?.count ?? position.count); i += 3) {
      a.fromBufferAttribute(position, vertexAt(i)).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, vertexAt(i + 1)).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, vertexAt(i + 2)).applyMatrix4(mesh.matrixWorld);
      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
      if (area === 0) continue;
      totalArea += area;
      triangles.push({ a: a.clone(), b: b.clone(), c: c.clone(), end: totalArea });
    }
  });

  const points = new Float32Array(count * 3);
  if (totalArea === 0) return points;
  for (let i = 0; i < count; i++) {
    const target = random() * totalArea;
    let low = 0;
    let high = triangles.length - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (target < triangles[middle].end) high = middle;
      else low = middle + 1;
    }
    const face = triangles[low];
    const u = Math.sqrt(random());
    const v = random();
    a.copy(face.a).multiplyScalar(1 - u)
      .addScaledVector(face.b, u * (1 - v))
      .addScaledVector(face.c, u * v);
    a.toArray(points, i * 3);
  }
  return points;
}
