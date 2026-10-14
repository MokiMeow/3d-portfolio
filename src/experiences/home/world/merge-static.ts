import { BufferAttribute, BufferGeometry, Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const KEEP = ["position", "normal", "uv", "color"] as const;
type Shaded = MeshStandardMaterial | MeshBasicMaterial;

/** Flips each triangle of a non-indexed geometry, for meshes whose transform mirrors them. */
function flipWinding(geometry: BufferGeometry): void {
  for (const name of KEEP) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const size = attribute.itemSize, array = attribute.array;
    for (let i = 0; i < attribute.count; i += 3) {
      for (let k = 0; k < size; k++) {
        const a = (i + 1) * size + k, b = (i + 2) * size + k;
        const t = array[a]!; array[a] = array[b]!; array[b] = t;
      }
    }
    attribute.needsUpdate = true;
  }
}

/** Everything about a material except its colour: materials that agree on this can share one draw call. */
function signature(material: Material): string | null {
  const m = material as Shaded & Partial<{ roughness: number; metalness: number; envMapIntensity: number; clearcoat: number; clearcoatRoughness: number; sheen: number; emissive: { getHexString(): string }; bumpMap: { uuid: string } | null; bumpScale: number; roughnessMap: { uuid: string } | null }>;
  if (!(m instanceof MeshStandardMaterial) && !(m instanceof MeshBasicMaterial)) return null;
  if (m.vertexColors || m.wireframe) return null;
  return [m.type, m.map?.uuid, m.bumpMap?.uuid, m.bumpScale, m.roughnessMap?.uuid, m.roughness, m.metalness, m.envMapIntensity,
    m.clearcoat, m.clearcoatRoughness, m.sheen, m.emissive?.getHexString(), m.transparent, m.opacity, m.side, m.depthWrite,
    m.depthTest, m.toneMapped, m.alphaTest, m.blending, m.onBeforeCompile.toString().length, m.customProgramCacheKey()].join("|");
}

/**
 * Collapses every static mesh under `root` into as few meshes as possible: meshes whose materials differ
 * only in colour are merged into one mesh that carries those colours per vertex. The furniture is built
 * from hundreds of small coloured boxes and cylinders, and each would otherwise be its own draw call.
 * Anything in `live` (and everything beneath it) is left alone, so objects that animate, change visibility,
 * swap materials or answer clicks keep working exactly as before. Returns the number of draw calls saved.
 */
export function mergeStatic(root: Object3D, live: Set<Object3D>, track: (item: BufferGeometry | Material) => void): number {
  root.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, Mesh[]>();
  const isLive = (object: Object3D) => {
    for (let node: Object3D | null = object; node; node = node.parent) {
      if (live.has(node) || !node.visible) return true;
      if (node === root) break;
    }
    return false;
  };
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || (mesh as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (mesh.morphTargetInfluences || isLive(mesh)) return;
    const key = signature(mesh.material);
    if (!key) return;
    const list = groups.get(key) ?? [];
    list.push(mesh);
    groups.set(key, list);
  });
  let saved = 0;
  const relative = new Matrix4();
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const parts: BufferGeometry[] = [];
    for (const mesh of meshes) {
      const source = mesh.material as Shaded;
      const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(part.attributes)) if (!(KEEP as readonly string[]).includes(name)) part.deleteAttribute(name);
      if (!part.getAttribute("normal")) part.computeVertexNormals();
      const count = part.getAttribute("position").count;
      if (!part.getAttribute("uv")) part.setAttribute("uv", new BufferAttribute(new Float32Array(count * 2), 2));
      // The material's colour moves into the vertices; the shared material is white.
      const colours = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { colours[i * 3] = source.color.r; colours[i * 3 + 1] = source.color.g; colours[i * 3 + 2] = source.color.b; }
      part.setAttribute("color", new BufferAttribute(colours, 3));
      relative.multiplyMatrices(inverse, mesh.matrixWorld);
      part.applyMatrix4(relative);
      if (relative.determinant() < 0) flipWinding(part);
      part.morphAttributes = {};
      parts.push(part);
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const first = meshes[0]!.material as Shaded;
    const material = first.clone();
    material.color.setRGB(1, 1, 1);
    material.vertexColors = true;
    // clone() does not carry shader hooks; the room's night tint lives in them.
    material.onBeforeCompile = first.onBeforeCompile;
    material.customProgramCacheKey = first.customProgramCacheKey;
    track(merged);
    track(material);
    const combined = new Mesh(merged, material);
    combined.name = "merged_static";
    combined.renderOrder = Math.max(...meshes.map(mesh => mesh.renderOrder));
    root.add(combined);
    for (const mesh of meshes) mesh.removeFromParent();
    saved += meshes.length - 1;
  }
  return saved;
}
