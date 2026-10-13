import {
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** A worn work boot and a two-leaf seedling, sized for the GLB's actual cargo bay. */
export function createBootPlant() {
  const root = new Group();
  root.name = "A little green hope";
  root.position.set(-0.025, 0.148, 0.025);
  root.rotation.y = -0.32;
  const leather = new MeshStandardMaterial({
    color: "#65422e",
    roughness: 0.93,
  });
  const sole = new MeshStandardMaterial({ color: "#292624", roughness: 1 });
  const stitch = new MeshStandardMaterial({ color: "#a0835c", roughness: 0.9 });
  const soil = new MeshStandardMaterial({ color: "#251b13", roughness: 1 });
  const leaf = new MeshStandardMaterial({
    color: "#628b31",
    roughness: 0.8,
    side: DoubleSide,
  });
  const vein = new MeshStandardMaterial({ color: "#9aa84c", roughness: 0.9 });
  const add = (
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    position: number[],
    scale = [1, 1, 1],
  ) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.fromArray(position);
    mesh.scale.fromArray(scale);
    root.add(mesh);
    return mesh;
  };
  add(
    new RoundedBoxGeometry(0.077, 0.014, 0.147, 3, 0.009),
    sole,
    [0, 0.007, 0.02],
  );
  add(
    new SphereGeometry(1, 24, 16),
    leather,
    [0, 0.028, 0.047],
    [0.038, 0.025, 0.064],
  );
  const profile = [
    [0.032, 0],
    [0.034, 0.026],
    [0.029, 0.059],
    [0.028, 0.077],
    [0.025, 0.079],
    [0.023, 0.075],
    [0.024, 0.037],
  ].map(([r, y]) => new Vector2(r, y));
  add(new LatheGeometry(profile, 28), leather, [0, 0.014, -0.018]);
  add(
    new TorusGeometry(0.026, 0.003, 8, 28),
    stitch,
    [0, 0.091, -0.018],
  ).rotation.x = Math.PI / 2;
  add(new CylinderGeometry(0.024, 0.024, 0.003, 24), soil, [0, 0.086, -0.018]);
  for (let i = 0; i < 5; i++) {
    add(new RoundedBoxGeometry(0.08, 0.004, 0.006, 1, 0.001), sole, [
      0,
      0.001,
      -0.035 + i * 0.025,
    ]);
    const z = 0.003 + i * 0.009;
    const lace = new CatmullRomCurve3([
      new Vector3(-0.016, 0.047, z),
      new Vector3(0, 0.052, z + 0.002),
      new Vector3(0.016, 0.047, z + 0.006),
    ]);
    add(new TubeGeometry(lace, 8, 0.0012, 5, false), stitch, [0, 0, 0]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(new SphereGeometry(0.0014, 5, 4), stitch, [
      Math.cos(a) * 0.033,
      0.023,
      0.03 + Math.sin(a) * 0.058,
    ]);
  }
  const stem = new CatmullRomCurve3([
    new Vector3(0, 0.085, -0.018),
    new Vector3(-0.006, 0.116, -0.019),
    new Vector3(0.004, 0.152, -0.016),
    new Vector3(0.001, 0.177, -0.018),
  ]);
  add(new TubeGeometry(stem, 18, 0.0017, 7, false), leaf, [0, 0, 0]);
  for (const [sign, height, length] of [
    [-1, 0.141, 0.047],
    [1, 0.155, 0.041],
  ]) {
    const positions: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12,
        x = 0.003 + sign * t * length,
        y = height + Math.sin(t * Math.PI) * 0.012 + t * 0.023;
      const half = Math.sin(t * Math.PI) * 0.019;
      positions.push(
        x,
        y - half * 0.5,
        -0.018 - half,
        x,
        y + 0.002,
        -0.018,
        x,
        y + half * 0.5,
        -0.018 + half,
      );
      if (i < 12)
        for (let side = 0; side < 2; side++) {
          const k = i * 3 + side;
          indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute(
      "uv",
      new Float32BufferAttribute(
        new Float32Array((positions.length / 3) * 2),
        2,
      ),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(geometry, leaf, [0, 0, 0]);
    const line = new CatmullRomCurve3([
      new Vector3(0.003, height + 0.002, -0.018),
      new Vector3(0.003 + sign * length * 0.5, height + 0.0255, -0.018),
      new Vector3(0.003 + sign * length, height + 0.025, -0.018),
    ]);
    add(new TubeGeometry(line, 10, 0.0006, 5, false), vein, [0, 0, 0]);
  }
  // Six material batches, including all tread ridges and stitches.
  root.updateMatrixWorld(true);
  const buckets = new Map<MeshStandardMaterial, BufferGeometry[]>();
  for (const child of [...root.children]) {
    const mesh = child as Mesh<BufferGeometry, MeshStandardMaterial>;
    const geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    const bucket = buckets.get(mesh.material) ?? [];
    bucket.push(geometry);
    buckets.set(mesh.material, bucket);
    mesh.geometry.dispose();
    mesh.removeFromParent();
  }
  for (const [material, parts] of buckets) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (geometry) root.add(new Mesh(geometry, material));
  }
  return root;
}
