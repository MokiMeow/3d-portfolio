import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Everything you can make, and what each is made of. Sizes are in metres; the base size is a hand-sized object. */
export const SHAPES = ['cube', 'sphere', 'cylinder', 'cone', 'pyramid', 'torus', 'capsule', 'star', 'heart', 'domino'] as const;
export type ShapeId = typeof SHAPES[number] | 'drawn';
export const SHAPE_NAMES: Record<ShapeId, string> = {
  cube: 'Cube', sphere: 'Sphere', cylinder: 'Cylinder', cone: 'Cone', pyramid: 'Pyramid', torus: 'Ring', capsule: 'Capsule', star: 'Star', heart: 'Heart', domino: 'Domino', drawn: 'Drawing',
};

export const MATERIALS = [
  { id: 'glass', name: 'Glass', swatch: 'linear-gradient(135deg,#e8f6ff,#9cc7e8 55%,#f6fbff)' },
  { id: 'chrome', name: 'Chrome', swatch: 'linear-gradient(135deg,#f4f6f8,#8b9097 45%,#e9ecef 60%,#5d6168)' },
  { id: 'gold', name: 'Gold', swatch: 'linear-gradient(135deg,#fff0b8,#d4a13c 50%,#8a5a12)' },
  { id: 'coral', name: 'Coral', swatch: '#ff5a4f' },
  { id: 'cobalt', name: 'Cobalt', swatch: '#2f6bff' },
  { id: 'lemon', name: 'Lemon', swatch: '#ffd23f' },
  { id: 'mint', name: 'Mint', swatch: '#3ed6a0' },
  { id: 'wood', name: 'Walnut', swatch: 'repeating-linear-gradient(100deg,#8a5a34 0 4px,#6e4527 4px 7px,#9a6a40 7px 11px)' },
  { id: 'marble', name: 'Marble', swatch: 'linear-gradient(135deg,#f7f5f0,#e2ded6 40%,#f7f5f0 55%,#cfc9bf)' },
  { id: 'clay', name: 'Clay', swatch: '#e8b59a' },
  { id: 'neon', name: 'Neon', swatch: 'radial-gradient(circle,#fff 0 18%,#ff3df2 45%,#7a2bff)' },
  { id: 'obsidian', name: 'Obsidian', swatch: 'linear-gradient(135deg,#3a3d46,#0c0d10)' },
] as const;
export type MaterialId = typeof MATERIALS[number]['id'];

/** Spoken words to materials: "glass", "wooden", "red", "glowing". */
export function materialFor(word: string | undefined): MaterialId | undefined {
  if (!word) return undefined;
  const map: Record<string, MaterialId> = {
    glass: 'glass', chrome: 'chrome', metal: 'chrome', silver: 'chrome', steel: 'chrome', gold: 'gold', golden: 'gold', rubber: 'coral', red: 'coral', coral: 'coral',
    blue: 'cobalt', cobalt: 'cobalt', yellow: 'lemon', lemon: 'lemon', green: 'mint', mint: 'mint', wood: 'wood', wooden: 'wood', walnut: 'wood',
    marble: 'marble', white: 'marble', clay: 'clay', pink: 'clay', orange: 'clay', neon: 'neon', glowing: 'neon', purple: 'neon', black: 'obsidian', obsidian: 'obsidian',
  };
  return map[word];
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** One material per finish, shared by every object made of it. */
export function makeMaterials() {
  const wood = canvasTexture(512, ctx => {
    ctx.fillStyle = '#7a4c2a'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 512, w = 1 + Math.random() * 4;
      ctx.strokeStyle = `rgba(${Math.random() < .5 ? '50,28,12' : '160,110,70'},${.15 + Math.random() * .3})`; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 70 + i) * 6 + Math.sin(x / 23) * 2);
      ctx.stroke();
    }
  });
  const marble = canvasTexture(512, ctx => {
    ctx.fillStyle = '#f2efe9'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(120,115,108,${.12 + Math.random() * .3})`; ctx.lineWidth = .6 + Math.random() * 2.2;
      ctx.beginPath(); let x = Math.random() * 512, y = 0; ctx.moveTo(x, y);
      while (y < 512) { x += (Math.random() - .5) * 40; y += 12 + Math.random() * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  const standard = (color: string, roughness: number, metalness = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness, envMapIntensity: 1, ...extra });
  const materials: Record<MaterialId, THREE.MeshPhysicalMaterial> = {
    glass: standard('#cfe9ff', .02, 0, { transparent: true, opacity: .2, clearcoat: 1, clearcoatRoughness: 0, ior: 1.5, specularIntensity: 1, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide }),
    chrome: standard('#ffffff', .06, 1, { envMapIntensity: 1.25 }),
    gold: standard('#ffcd73', .24, 1, { envMapIntensity: 1.35 }),
    coral: standard('#ff4d42', .42, 0, { clearcoat: .6, clearcoatRoughness: .3 }),
    cobalt: standard('#2a62ff', .42, 0, { clearcoat: .6, clearcoatRoughness: .3 }),
    lemon: standard('#ffd23f', .42, 0, { clearcoat: .6, clearcoatRoughness: .3 }),
    mint: standard('#33d39a', .42, 0, { clearcoat: .6, clearcoatRoughness: .3 }),
    wood: standard('#ffffff', .62, 0, { map: wood, clearcoat: .35, clearcoatRoughness: .4 }),
    marble: standard('#ffffff', .18, 0, { map: marble, clearcoat: .8, clearcoatRoughness: .1 }),
    clay: standard('#e5b095', .92, 0, { sheen: .5, sheenColor: new THREE.Color('#ffd9c4') }),
    neon: standard('#ff4df4', .3, 0, { emissive: new THREE.Color('#ff3df2'), emissiveIntensity: 2.4, toneMapped: false }),
    obsidian: standard('#16171c', .08, .2, { clearcoat: 1, clearcoatRoughness: .02 }),
  };
  return { materials, textures: [wood, marble] };
}

/* Outlines for the extruded shapes. */
function starShape(points = 5, outer = .5, inner = .22) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 ? inner : outer, a = i / (points * 2) * Math.PI * 2 + Math.PI / 2;
    if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return shape;
}
function heartShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.42);
  shape.bezierCurveTo(-.08, -.3, -.5, -.08, -.5, .14);
  shape.bezierCurveTo(-.5, .38, -.26, .48, -.12, .44);
  shape.bezierCurveTo(-.04, .42, 0, .34, 0, .3);
  shape.bezierCurveTo(0, .34, .04, .42, .12, .44);
  shape.bezierCurveTo(.26, .48, .5, .38, .5, .14);
  shape.bezierCurveTo(.5, -.08, .08, -.3, 0, -.42);
  return shape;
}
export function extrude(shape: THREE.Shape, depth: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 28 });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

/** A convex physics hull around any geometry, for shapes cannon has no primitive for. */
export function hull(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position');
  const points: THREE.Vector3[] = [];
  const step = Math.max(1, Math.floor(position.count / 400));
  for (let i = 0; i < position.count; i += step) points.push(new THREE.Vector3().fromBufferAttribute(position, i));
  const convex = new ConvexHull().setFromPoints(points);
  const vertices: CANNON.Vec3[] = [], index = new Map<THREE.Vector3, number>(), faces: number[][] = [];
  for (const face of convex.faces) {
    const loop: number[] = [];
    let edge = face.edge;
    do {
      const point = edge.head().point;
      if (!index.has(point)) { index.set(point, vertices.length); vertices.push(new CANNON.Vec3(point.x, point.y, point.z)); }
      loop.push(index.get(point)!);
      edge = edge.next;
    } while (edge !== face.edge);
    faces.push(loop);
  }
  // Cannon wants every face wound anticlockwise seen from outside; turn round any that face inward.
  const centre = vertices.reduce((sum, v) => sum.vadd(v), new CANNON.Vec3()).scale(1 / vertices.length);
  for (const face of faces) {
    const [a, b, c] = face.map(i => vertices[i]!);
    const normal = b!.vsub(a!).cross(c!.vsub(a!));
    if (normal.dot(a!.vsub(centre)) < 0) face.reverse();
  }
  return new CANNON.ConvexPolyhedron({ vertices, faces });
}

export type Made = { geometry: THREE.BufferGeometry; shapes: { shape: CANNON.Shape; offset?: CANNON.Vec3; orientation?: CANNON.Quaternion }[]; mass: number };

/** Geometry and matching physics for one object of a given size (metres across). */
export function make(shape: ShapeId, size: number, drawn?: THREE.Shape): Made {
  const s = size;
  switch (shape) {
    case 'cube': return { geometry: new RoundedBoxGeometry(s, s, s, 4, s * .08), shapes: [{ shape: new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)) }], mass: s * s * s * 600 };
    case 'domino': return { geometry: new RoundedBoxGeometry(s * .5, s, s * .14, 3, s * .03), shapes: [{ shape: new CANNON.Box(new CANNON.Vec3(s * .25, s / 2, s * .07)) }], mass: s * s * s * 60 };
    case 'sphere': return { geometry: new THREE.SphereGeometry(s / 2, 48, 32), shapes: [{ shape: new CANNON.Sphere(s / 2) }], mass: s * s * s * 320 };
    case 'cylinder': return { geometry: new THREE.CylinderGeometry(s * .4, s * .4, s, 48), shapes: [{ shape: new CANNON.Cylinder(s * .4, s * .4, s, 20) }], mass: s * s * s * 450 };
    case 'cone': return { geometry: new THREE.ConeGeometry(s * .45, s, 48), shapes: [{ shape: new CANNON.Cylinder(.001, s * .45, s, 20) }], mass: s * s * s * 220 };
    case 'pyramid': {
      const geometry = new THREE.ConeGeometry(s * .55, s * .8, 4);
      geometry.rotateY(Math.PI / 4);
      return { geometry, shapes: [{ shape: hull(geometry) }], mass: s * s * s * 200 };
    }
    case 'torus': {
      const geometry = new THREE.TorusGeometry(s * .34, s * .14, 24, 64);
      return { geometry, shapes: [{ shape: hull(geometry) }], mass: s * s * s * 150 };
    }
    case 'capsule': {
      const geometry = new THREE.CapsuleGeometry(s * .25, s * .5, 12, 32);
      return {
        geometry, mass: s * s * s * 260,
        shapes: [{ shape: new CANNON.Cylinder(s * .25, s * .25, s * .5, 16) }, { shape: new CANNON.Sphere(s * .25), offset: new CANNON.Vec3(0, s * .25, 0) }, { shape: new CANNON.Sphere(s * .25), offset: new CANNON.Vec3(0, -s * .25, 0) }],
      };
    }
    case 'star': case 'heart': case 'drawn': {
      const outline = shape === 'star' ? starShape() : shape === 'heart' ? heartShape() : drawn!;
      const geometry = extrude(outline, .18, .045);
      geometry.scale(s, s, s);
      const welded = mergeVertices(geometry.clone().deleteAttribute('normal').deleteAttribute('uv'));
      const physics = hull(welded);
      welded.dispose();
      return { geometry, shapes: [{ shape: physics }], mass: s * s * s * 180 };
    }
  }
}

/**
 * A freehand outline from the screen, cleaned up: resampled evenly, smoothed, closed and scaled to fit
 * a unit box, so a quick doodle becomes a tidy solid. Returns undefined if it is too small to be a shape.
 */
export function outline(points: { x: number; y: number }[]) {
  if (points.length < 6) return undefined;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  if (Math.max(w, h) < 24) return undefined;
  // Resample to 64 evenly spaced points along the stroke.
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  const total = lengths[lengths.length - 1]!, even: { x: number; y: number }[] = [];
  for (let k = 0, j = 0; k < 64; k++) {
    const at = total * k / 64;
    while (j < lengths.length - 2 && lengths[j + 1]! < at) j++;
    const t = (at - lengths[j]!) / Math.max(1e-6, lengths[j + 1]! - lengths[j]!);
    even.push({ x: points[j]!.x + (points[j + 1]!.x - points[j]!.x) * t, y: points[j]!.y + (points[j + 1]!.y - points[j]!.y) * t });
  }
  const smooth = even.map((_, i) => {
    let x = 0, y = 0;
    for (let k = -2; k <= 2; k++) { const p = even[(i + k + 64) % 64]!; x += p.x; y += p.y; }
    return { x: x / 5, y: y / 5 };
  });
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2, scale = Math.max(w, h);
  const shape = new THREE.Shape(smooth.map(p => new THREE.Vector2((p.x - cx) / scale, -(p.y - cy) / scale)));
  return { shape, aspect: w / Math.max(1, h) };
}
