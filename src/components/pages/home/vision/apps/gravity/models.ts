import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type * as Physics from 'cannon-es';
import { objects, surfaces, type ObjectKind, type Surface } from './catalog';

export type Toy = { mesh: THREE.Group; body: Physics.Body; height: number; kind: ObjectKind; surface: Surface };

/** Shared geometry and procedural textures: no assets or extra requests. */
export class ToyFactory {
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.Material>();
  private readonly textures = new Map<string, THREE.CanvasTexture>();
  private serial = 0;

  constructor(private readonly C: typeof Physics) {}

  private geometry(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let value = this.geometries.get(key);
    if (!value) { value = create(); this.geometries.set(key, value); }
    return value;
  }

  private texture(key: string): THREE.CanvasTexture {
    const found = this.textures.get(key);
    if (found) return found;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    if (key === 'grain') {
      ctx.fillStyle = '#e4bd87'; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 100; i++) {
        const y = i * 2.6;
        ctx.strokeStyle = i % 3 ? 'rgba(107,66,28,.09)' : 'rgba(255,241,208,.24)';
        ctx.lineWidth = i % 4 === 0 ? 1.8 : .7;
        ctx.beginPath(); ctx.moveTo(0, y);
        ctx.bezierCurveTo(80, y + Math.sin(i) * 9, 150, y - Math.cos(i * .8) * 8, 256, y + 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#f4dfb6'; ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#caad81'; ctx.lineWidth = 12; ctx.strokeRect(12, 12, 232, 232);
      ctx.strokeStyle = '#fff0ce'; ctx.lineWidth = 4; ctx.strokeRect(23, 23, 210, 210);
      ctx.fillStyle = ['#628977', '#cc7464', '#657dae'][key.charCodeAt(0) % 3] ?? '#628977';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 168px Georgia, serif';
      ctx.fillText(key, 128, 140);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(key, texture);
    return texture;
  }

  private material(surface: Surface, color: string): THREE.Material {
    const key = surface + color;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const spec = surfaces.find(item => item.id === surface)!;
    const material = new THREE.MeshPhysicalMaterial({
      color: surface === 'wood' ? '#f6dbc0' : color,
      roughness: spec.roughness, metalness: spec.metalness,
      map: surface === 'wood' ? this.texture('grain') : null,
      clearcoat: surface === 'plastic' || surface === 'glass' ? .65 : .1,
      clearcoatRoughness: .18, envMapIntensity: .6,
      // A frosted, glass-like finish avoids expensive screen-space transmission.
      transparent: surface === 'glass', opacity: surface === 'glass' ? .66 : 1,
      depthWrite: surface !== 'glass',
    });
    this.materials.set(key, material);
    return material;
  }

  create(kind: ObjectKind, surface: Surface, physicsMaterial: Physics.Material): Toy {
    const C = this.C;
    const serial = this.serial++;
    const color = objects.find(item => item.id === kind)!.color;
    const finish = this.material(surface, color);
    const white = this.material('plastic', '#fcfaf3');
    const dark = this.material('rubber', '#3b3b53');
    const mesh = new THREE.Group();
    const spec = surfaces.find(item => item.id === surface)!;
    const body = new C.Body({ mass: spec.density, material: physicsMaterial, allowSleep: true, sleepSpeedLimit: .14, sleepTimeLimit: 1.1, linearDamping: .08, angularDamping: .16 });
    let height = .5;
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
      const value = new THREE.Mesh(geometry, material);
      value.position.set(x, y, z); value.castShadow = true; value.receiveShadow = true;
      mesh.add(value); return value;
    };
    const sphere = (radius: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh =>
      part(this.geometry('sphere-' + radius, () => new THREE.SphereGeometry(radius, 20, 12)), material, x, y, z);
    const box = (x: number, y: number, z: number, material = finish): THREE.Mesh =>
      part(this.geometry('box-' + [x, y, z], () => new RoundedBoxGeometry(x, y, z, 2, Math.min(.07, x / 5, y / 5, z / 5))), material);
    const cylinder = (top: number, bottom: number, h: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh =>
      part(this.geometry('cylinder-' + [top, bottom, h], () => new THREE.CylinderGeometry(top, bottom, h, 24)), material, x, y, z);
    const torus = (radius: number, tube: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh =>
      part(this.geometry('torus-' + [radius, tube], () => new THREE.TorusGeometry(radius, tube, 8, 32)), material, x, y, z);
    const shapeSphere = (radius: number, x = 0, y = 0, z = 0): void => { body.addShape(new C.Sphere(radius), new C.Vec3(x, y, z)); };
    const shapeBox = (x: number, y: number, z: number): void => { body.addShape(new C.Box(new C.Vec3(x / 2, y / 2, z / 2))); };

    if (kind === 'cube' || kind === 'block') {
      box(.95, .95, .95); shapeBox(.95, .95, .95); height = .475;
      if (kind === 'block') {
        const letter = String.fromCharCode(65 + serial % 6);
        const key = 'letter-' + letter;
        let ink = this.materials.get(key);
        if (!ink) { ink = new THREE.MeshStandardMaterial({ map: this.texture(letter), roughness: .8 }); this.materials.set(key, ink); }
        const face = this.geometry('letter-plane', () => new THREE.PlaneGeometry(.8, .8));
        part(face, ink, 0, 0, .478);
        part(face, ink, .478, 0, 0).rotation.y = Math.PI / 2;
        part(face, ink, 0, .478, 0).rotation.x = -Math.PI / 2;
        part(face, ink, 0, 0, -.478).rotation.y = Math.PI;
        part(face, ink, -.478, 0, 0).rotation.y = -Math.PI / 2;
        part(face, ink, 0, -.478, 0).rotation.x = Math.PI / 2;
      }
    } else if (kind === 'ball' || kind === 'bowling') {
      const r = kind === 'bowling' ? .65 : .5;
      sphere(r, finish); shapeSphere(r); height = r;
      if (kind === 'bowling') {
        body.mass *= 3; body.updateMassProperties();
        for (const [x, y] of [[-.13, .26], [.13, .26], [0, .02]] as const) {
          const dot = sphere(.075, dark, x, y, Math.sqrt(r * r - x * x - y * y) - .025);
          dot.scale.z = .3;
        }
        const ring = torus(.58, .018, this.material('plastic', '#bcaeea'));
        ring.rotation.x = .6; ring.rotation.y = .3;
      } else {
        const seam = torus(.495, .018, white); seam.rotation.x = .5;
        const other = torus(.495, .018, white); other.rotation.y = Math.PI / 2;
      }
    } else if (kind === 'cylinder') {
      cylinder(.44, .44, 1.15, finish); body.addShape(new C.Cylinder(.44, .44, 1.15, 16)); height = .575;
      const rim = torus(.40, .035, white, 0, .576, 0); rim.rotation.x = Math.PI / 2;
    } else if (kind === 'plank') {
      box(2.7, .28, .65); shapeBox(2.7, .28, .65); height = .14;
    } else if (kind === 'domino') {
      box(.58, 1.6, .08); shapeBox(.58, 1.6, .08); height = .8;
      body.sleepSpeedLimit = .05; body.angularDamping = .03;
      const line = box(.46, .018, .008, dark); line.position.set(0, 0, .044);
      const pips: readonly (readonly [number, number])[] = [[-.14, .36], [.14, .17], [0, -.28], [-.14, -.45], [.14, -.12]];
      for (const [x, y] of pips) { const pip = sphere(.044, dark, x, y, .044); pip.scale.z = .3; }
    } else if (kind === 'duck') {
      const yellow = surface === 'plastic' || surface === 'rubber' ? this.material(surface, '#ffce47') : finish;
      sphere(.48, yellow, 0, -.12, 0).scale.set(1.15, .85, 1.35);
      sphere(.33, yellow, 0, .38, .29);
      const beak = cylinder(0, .16, .34, this.material('plastic', '#f89b39'), 0, .31, .65);
      beak.rotation.x = Math.PI / 2;
      const tail = cylinder(0, .19, .4, yellow, 0, .02, -.53); tail.rotation.x = -.8;
      sphere(.035, dark, -.21, .48, .5); sphere(.035, dark, .21, .48, .5);
      const wing = sphere(.23, yellow, .43, -.09, -.04); wing.scale.set(.3, .7, 1.4);
      const wing2 = sphere(.23, yellow, -.43, -.09, -.04); wing2.scale.set(.3, .7, 1.4);
      shapeSphere(.46, 0, -.12, 0); shapeSphere(.3, 0, .38, .29);
      const rotation = new C.Quaternion(); rotation.setFromEuler(Math.PI / 2, 0, 0);
      body.addShape(new C.Cylinder(.01, .15, .33, 8), new C.Vec3(0, .31, .65), rotation);
      height = .58;
    } else if (kind === 'cup') {
      cylinder(.43, .33, .82, finish); body.addShape(new C.Cylinder(.43, .33, .82, 16));
      cylinder(.37, .37, .016, this.material('plastic', '#956044'), 0, .415, 0);
      const rim = torus(.4, .042, white, 0, .43, 0); rim.rotation.x = Math.PI / 2;
      torus(.27, .075, finish, .52, .02, 0);
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2;
        shapeSphere(.075, .52 + Math.cos(angle) * .27, .02 + Math.sin(angle) * .27, 0);
      }
      height = .41;
    } else if (kind === 'pin') {
      const pinFinish = surface === 'plastic' ? white : finish;
      const profile: readonly (readonly [number, number])[] = [[.19, -.65], [.31, -.58], [.35, -.35], [.3, -.05], [.17, .25], [.12, .46], [.2, .59], [.21, .74], [.13, .88], [0, .93]];
      part(this.geometry('pin', () => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 24)), pinFinish);
      const red = this.material('plastic', '#ee6e72');
      cylinder(.137, .15, .06, red, 0, .35, 0); cylinder(.128, .132, .055, red, 0, .45, 0);
      body.addShape(new C.Cylinder(.18, .3, .8, 12), new C.Vec3(0, -.25, 0));
      shapeSphere(.2, 0, .71, 0); body.addShape(new C.Cylinder(.13, .18, .45, 12), new C.Vec3(0, .35, 0));
      height = .65;
    }
    // Combine decorative parts by finish, so a 120-toy scene stays inexpensive.
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of mesh.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const parts = groups.get(child.material) ?? [];
      parts.push(child); groups.set(child.material, parts);
    }
    for (const [material, parts] of groups) {
      if (parts.length < 2) continue;
      const key = 'merged-' + kind + '-' + surface + '-' + (kind === 'block' ? serial % 6 : '') + '-' + material.uuid;
      let merged = this.geometries.get(key);
      if (!merged) {
        const buffers = parts.map(value => {
          value.updateMatrix();
          const transformed = value.geometry.clone().applyMatrix4(value.matrix);
          if (!transformed.index) return transformed;
          const unpacked = transformed.toNonIndexed(); transformed.dispose(); return unpacked;
        });
        const result = mergeGeometries(buffers, false);
        buffers.forEach(value => value.dispose());
        if (!result) continue;
        merged = result; this.geometries.set(key, merged);
      }
      mesh.remove(...parts);
      part(merged, material);
    }
    return { mesh, body, height, kind, surface };
  }

  dispose(): void {
    for (const value of this.geometries.values()) value.dispose();
    for (const value of this.materials.values()) value.dispose();
    for (const value of this.textures.values()) value.dispose();
    this.geometries.clear(); this.materials.clear(); this.textures.clear();
  }
}
