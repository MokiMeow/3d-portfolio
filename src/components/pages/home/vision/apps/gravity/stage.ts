import * as THREE from 'three';
import type * as Physics from 'cannon-es';
import { ToyFactory, type Toy } from './models';
import { ImpactSound } from './impact';
import { gravities, surfaces, type GravityMode, type ObjectKind, type ObjectInspection, type PlaygroundStats, type Preset, type Surface } from './catalog';

type LiveToy = Toy & { collision: (event: { contact: Physics.ContactEquation }) => void };
type FadingToy = { mesh: THREE.Group; materials: THREE.Material[]; started: number; opacity: number[] };
type Arrangement = { toy: LiveToy; from: THREE.Vector3; to: THREE.Vector3; rotation: THREE.Quaternion; targetRotation: THREE.Quaternion };
type Drag = { toy: LiveToy; joint: Physics.PointToPointConstraint; plane: THREE.Plane; last: THREE.Vector3; time: number; velocity: THREE.Vector3 };

export class GravityStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly world: Physics.World;
  private readonly factory: ToyFactory;
  private readonly audio = new ImpactSound();
  private readonly materials = new Map<Surface, Physics.Material>();
  private readonly floorMaterial: Physics.Material;
  private readonly toys: LiveToy[] = [];
  private readonly ghosts: FadingToy[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly cursor = new THREE.Vector2();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly anchor: Physics.Body;
  private readonly observer: ResizeObserver;
  private readonly intersection: IntersectionObserver;
  private readonly ownedGeometry: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private studioTexture?: THREE.CanvasTexture;
  private readonly light: THREE.DirectionalLight;
  private frame = 0;
  private previous = 0;
  private lastInput = 0;
  private statsKey = '';
  private lastStats = 0;
  private visible = true;
  private disposed = false;
  private paused = false;
  private mode: GravityMode = 'earth';
  private slow = false;
  private tool: ObjectKind = 'cube';
  private surface: Surface = 'plastic';
  private drag?: Drag;
  private pointer?: number;
  private sprayStart = 0;
  private sprayInterval = 0;
  private dropPoint?: THREE.Vector3;
  private tidyStarted = 0;
  private arrangements: Arrangement[] = [];
  private contextFailed = false;
  private reducedMotion = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly C: typeof Physics,
    private readonly onStats: (stats: PlaygroundStats) => void,
    private readonly onError: (message: string) => void,
    private readonly onInspect?: (object: ObjectInspection) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.renderer.domElement);
    this.world = new C.World({ gravity: new C.Vec3(0, -9.81, 0), allowSleep: true });
    this.world.broadphase = new C.SAPBroadphase(this.world);
    const solver = new C.GSSolver(); solver.iterations = 14; solver.tolerance = .001;
    this.world.solver = solver;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;
    this.floorMaterial = new C.Material('studio-floor');
    for (const spec of surfaces) this.materials.set(spec.id, new C.Material(spec.id));
    for (const a of surfaces) {
      const materialA = this.materials.get(a.id)!;
      this.world.addContactMaterial(new C.ContactMaterial(materialA, this.floorMaterial, { friction: a.friction, restitution: a.bounce }));
      for (const b of surfaces) {
        if (surfaces.indexOf(b) < surfaces.indexOf(a)) continue;
        this.world.addContactMaterial(new C.ContactMaterial(materialA, this.materials.get(b.id)!, { friction: Math.sqrt(a.friction * b.friction), restitution: Math.max(a.bounce, b.bounce) }));
      }
    }
    this.factory = new ToyFactory(C);
    this.anchor = new C.Body({ type: C.Body.KINEMATIC, collisionFilterGroup: 0, collisionFilterMask: 0 });
    this.world.addBody(this.anchor);
    this.plane(new C.Vec3(0, 0, 0), -Math.PI / 2, 0);
    this.plane(new C.Vec3(-7.4, 0, 0), 0, Math.PI / 2);
    this.plane(new C.Vec3(7.4, 0, 0), 0, -Math.PI / 2);
    this.plane(new C.Vec3(0, 0, -5.6), 0, 0);
    this.plane(new C.Vec3(0, 0, 5.6), 0, Math.PI);
    // A ceiling contains Zero-G throws.
    this.plane(new C.Vec3(0, 8, 0), Math.PI / 2, 0);
    this.scene.add(new THREE.HemisphereLight('#fffaf3', '#9aa5ba', 1));
    this.light = new THREE.DirectionalLight('#fff4e6', 2.7);
    this.light.position.set(-5, 11, 6);
    this.light.castShadow = true; this.light.shadow.mapSize.set(1024, 1024);
    Object.assign(this.light.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: .5, far: 30 });
    this.light.shadow.bias = -.00035; this.light.shadow.normalBias = .035;
    this.light.shadow.radius = 3;
    this.scene.add(this.light, this.light.target);
    this.studio();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.intersection = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      this.visible = entry.isIntersecting;
      this.visibility();
    }, { threshold: .01 });
    this.intersection.observe(host);
    document.addEventListener('visibilitychange', this.visibility);
    host.addEventListener('pointerdown', this.down);
    host.addEventListener('pointermove', this.move);
    host.addEventListener('pointerup', this.up);
    host.addEventListener('pointercancel', this.cancel);
    host.addEventListener('lostpointercapture', this.cancel);
    host.addEventListener('contextmenu', this.contextMenu);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.resize();
    this.welcome();
  }

  private plane(position: Physics.Vec3, x: number, y: number): void {
    const body = new this.C.Body({ mass: 0, material: this.floorMaterial, shape: new this.C.Plane() });
    body.position.copy(position); body.quaternion.setFromEuler(x, y, 0);
    this.world.addBody(body);
  }

  private studio(): void {
    // A tiny studio light map gives metal and frosted glass believable reflections.
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#eceef4'; ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(36, 20, 175, 110); ctx.fillRect(340, 38, 102, 94);
      ctx.fillStyle = '#c1cbd9'; ctx.fillRect(0, 176, 512, 80);
      this.studioTexture = new THREE.CanvasTexture(canvas);
      this.studioTexture.mapping = THREE.EquirectangularReflectionMapping;
      this.studioTexture.colorSpace = THREE.SRGBColorSpace;
      this.scene.environment = this.studioTexture;
    }
    const geometry = new THREE.PlaneGeometry(200, 200);
    const material = new THREE.MeshStandardMaterial({ color: '#dfe1e7', roughness: .92 });
    this.ownedGeometry.push(geometry); this.ownedMaterials.push(material);
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.y = -.018;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(16, 32, '#b7bdc8', '#cdd1da');
    grid.position.y = .001;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const m of gridMaterials) { m.transparent = true; m.opacity = .28; }
    this.ownedGeometry.push(grid.geometry); this.ownedMaterials.push(...gridMaterials);
    this.scene.add(grid);
    // Thin rounded stage edge and scale marks anchor the objects in the studio.
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-7.3, .006, -5.5), new THREE.Vector3(7.3, .006, -5.5),
        new THREE.Vector3(7.3, .006, 5.5), new THREE.Vector3(-7.3, .006, 5.5),
      ]), new THREE.LineBasicMaterial({ color: '#bac3d5', transparent: true, opacity: .48 }),
    );
    this.ownedGeometry.push(ring.geometry); this.ownedMaterials.push(ring.material);
    this.scene.add(ring);
    this.scene.fog = new THREE.Fog('#e5e7ef', 22, 48);
  }

  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    // Keep the full volume visible, including wide presets on a phone.
    const target = new THREE.Vector3(0, .9, 0);
    const direction = new THREE.Vector3(3, 9.5, 13).normalize();
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const distance = Math.max(12, 6.4 / Math.tan(horizontalFov / 2), 5 / Math.tan(verticalFov / 2));
    this.camera.position.copy(target).addScaledVector(direction, distance);
    this.camera.lookAt(target); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    this.request();
  }

  setTool(kind: ObjectKind, surface: Surface): void { this.tool = kind; this.surface = surface; }
  setSound(enabled: boolean): void { this.audio.setEnabled(enabled); }
  unlockSound(): void { this.audio.unlock(); }

  setGravity(mode: GravityMode): void {
    this.finishTidy(); this.mode = mode;
    this.world.gravity.set(0, -(gravities.find(g => g.id === mode)?.value ?? 9.81), 0);
    for (const toy of this.toys) {
      toy.body.wakeUp();
      toy.body.linearDamping = mode === 'zero' ? .015 : .08;
      if (mode === 'zero') toy.body.velocity.set(Math.sin(toy.body.id * 2) * .18, .18 + (toy.body.id % 4) * .04, Math.cos(toy.body.id) * .16);
    }
    this.request();
  }
  setSlow(value: boolean): void { this.slow = value; this.request(); }
  setPaused(value: boolean): void { this.paused = value; this.cancel(); this.request(); this.publish(true); }

  private add(kind: ObjectKind, surface: Surface, x: number, y: number, z: number, angle = 0): LiveToy {
    if (this.toys.length >= 120) {
      const oldest = this.toys.find(toy => toy !== this.drag?.toy);
      if (oldest) this.retire(oldest);
    }
    const asset = this.factory.create(kind, surface, this.materials.get(surface)!);
    asset.body.position.set(x, y, z);
    asset.body.quaternion.setFromEuler(0, angle, 0);
    asset.mesh.position.set(x, y, z); asset.mesh.quaternion.set(0, Math.sin(angle / 2), 0, Math.cos(angle / 2));
    const collision = (event: { contact: Physics.ContactEquation }): void => {
      this.audio.click(Math.abs(event.contact.getImpactVelocityAlongNormal()), surface);
    };
    const toy: LiveToy = { ...asset, collision };
    asset.mesh.userData.toy = toy;
    asset.body.addEventListener('collide', collision);
    this.scene.add(asset.mesh); this.world.addBody(asset.body); this.toys.push(toy);
    this.statsKey = '';
    return toy;
  }

  private retire(toy: LiveToy): void {
    toy.body.removeEventListener('collide', toy.collision);
    this.world.removeBody(toy.body);
    const index = this.toys.indexOf(toy);
    if (index >= 0) this.toys.splice(index, 1);
    delete toy.mesh.userData.toy;
    const cloned: THREE.Material[] = [];
    toy.mesh.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const originals: THREE.Material[] = Array.isArray(node.material) ? node.material : [node.material];
      const copies = originals.map(original => {
        const material = original.clone(); material.transparent = true; material.depthWrite = false;
        cloned.push(material); return material;
      });
      node.material = Array.isArray(node.material) ? copies : copies[0]!;
    });
    this.ghosts.push({ mesh: toy.mesh, materials: cloned, opacity: cloned.map(m => m.opacity), started: performance.now() });
    // Rapid spraying cannot leave an unbounded tail of fading render objects.
    if (this.ghosts.length > 8) this.removeGhost(this.ghosts[0]!);
    this.statsKey = '';
  }

  private removeGhost(ghost: FadingToy): void {
    this.scene.remove(ghost.mesh);
    for (const material of ghost.materials) material.dispose();
    const index = this.ghosts.indexOf(ghost); if (index >= 0) this.ghosts.splice(index, 1);
  }

  dropAtCenter(): void { this.audio.unlock(); this.drop(new THREE.Vector3(0, 0, 1)); }
  private drop(point: THREE.Vector3): void {
    this.finishTidy();
    const x = THREE.MathUtils.clamp(point.x, -5.8, 5.8);
    const z = THREE.MathUtils.clamp(point.z, -4.5, 4.5);
    const toy = this.add(this.tool, this.surface, x, 5.2, z, (this.toys.length % 7) * .17);
    if (this.mode === 'zero') toy.body.velocity.set(.12, -.4, .05);
    this.request(); this.publish(true);
  }

  private welcome(): void {
    this.add('cube', 'plastic', -1.7, .475, 0, -.12);
    this.add('cube', 'plastic', -1.7, 1.425, 0, .06);
    this.add('ball', 'rubber', 1.65, .5, 1.15);
    this.add('duck', 'rubber', .6, .59, -.6, -.4);
    this.add('block', 'wood', -2.7, .475, 1.8, .27);
    this.add('cylinder', 'plastic', 2.3, .575, -1.3, .1);
    this.add('cup', 'plastic', -.2, .41, 1.9, -.25);
    this.request(); this.publish(true);
  }

  clear(): void {
    this.cancel(); this.finishTidy();
    for (const toy of [...this.toys]) {
      toy.body.removeEventListener('collide', toy.collision);
      this.world.removeBody(toy.body); this.scene.remove(toy.mesh);
    }
    this.toys.length = 0;
    for (const ghost of [...this.ghosts]) this.removeGhost(ghost);
    this.request(); this.publish(true);
  }

  loadPreset(preset: Preset): void {
    this.clear(); this.audio.unlock();
    if (preset === 'domino') {
      for (let i = 0; i < 26; i++) {
        const t = i / 25 * 2.8 - 1.4;
        this.add('domino', 'plastic', Math.sin(t) * 3.4, .803, Math.cos(t) * 3.4 - 1.5, Math.atan2(Math.cos(t), -Math.sin(t)));
      }
    } else if (preset === 'tower') {
      for (let row = 0; row < 9; row++) for (let column = 0; column < 3; column++) {
        const odd = row % 2 === 1, offset = (column - 1) * .72;
        this.add('plank', 'wood', odd ? offset : 0, .145 + row * .285, odd ? 0 : offset, odd ? Math.PI / 2 : 0);
      }
    } else {
      for (let row = 0; row < 4; row++) for (let column = 0; column <= row; column++) {
        this.add('pin', 'plastic', (column - row / 2) * .95, .655, -1.5 - row * .85);
      }
      this.add('bowling', 'plastic', 0, .65, 3.5);
    }
    this.request(); this.publish(true);
  }

  nudge(): void {
    this.audio.unlock(); this.finishTidy();
    const first = this.toys[0]; if (!first) return;
    first.body.wakeUp();
    if (first.kind === 'domino') {
      const direction = first.body.quaternion.vmult(new this.C.Vec3(0, 0, 3));
      first.body.applyImpulse(direction, new this.C.Vec3(0, .65, 0));
    } else {
      const ball = this.toys.find(toy => toy.kind === 'bowling');
      if (ball) {
        ball.body.wakeUp(); ball.body.velocity.set(.15, 0, -10);
        ball.body.angularVelocity.set(-10 / .65, 0, .15);
      } else {
        for (const toy of this.toys) {
          toy.body.wakeUp();
          toy.body.applyImpulse(new this.C.Vec3(toy.body.mass * toy.body.position.y * 14, toy.body.mass * .4, 0));
        }
      }
    }
    this.request();
  }

  explode(): void {
    this.audio.unlock(); this.cancel(); this.finishTidy();
    for (const toy of this.toys) {
      const p = toy.body.position;
      const direction = new this.C.Vec3(p.x, Math.max(.8, p.y), p.z);
      direction.normalize();
      direction.scale(Math.min(9, toy.body.mass * 5), direction);
      toy.body.wakeUp(); toy.body.applyImpulse(direction);
    }
    this.request();
  }

  tidy(): void {
    this.cancel(); this.finishTidy();
    const columns = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(this.toys.length * 1.4))));
    const rows = Math.min(7, Math.ceil(this.toys.length / columns));
    const cells = columns * Math.max(1, rows);
    this.arrangements = this.toys.map((toy, i) => {
      toy.body.type = this.C.Body.KINEMATIC; toy.body.velocity.setZero(); toy.body.angularVelocity.setZero();
      const plank = toy.kind === 'plank';
      return {
        toy, from: toy.mesh.position.clone(), rotation: toy.mesh.quaternion.clone(),
        to: new THREE.Vector3((i % columns - (columns - 1) / 2) * 1.4, (plank ? 1.35 : toy.height + .01) + Math.floor(i / cells) * 3.1, (Math.floor((i % cells) / columns) - (rows - 1) / 2) * 1.4),
        targetRotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, plank ? Math.PI / 2 : 0)),
      };
    });
    this.tidyStarted = performance.now();
    if (this.reducedMotion) this.applyTidy(1);
    this.request();
  }

  private applyTidy(progress: number): void {
    const eased = 1 - Math.pow(1 - progress, 3);
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion();
    for (const item of this.arrangements) {
      position.lerpVectors(item.from, item.to, eased);
      rotation.copy(item.rotation).slerp(item.targetRotation, eased);
      item.toy.body.position.set(position.x, position.y, position.z);
      item.toy.body.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      item.toy.body.velocity.setZero(); item.toy.body.angularVelocity.setZero();
      item.toy.body.aabbNeedsUpdate = true;
      item.toy.mesh.position.copy(position); item.toy.mesh.quaternion.copy(rotation);
    }
    if (progress === 1) this.finishTidy();
  }

  private finishTidy(): void {
    for (const item of this.arrangements) {
      item.toy.body.type = this.C.Body.DYNAMIC;
      item.toy.body.updateMassProperties(); item.toy.body.wakeUp();
    }
    this.arrangements = [];
  }

  private point(event: Pick<PointerEvent, 'clientX' | 'clientY'>): void {
    const bounds = this.host.getBoundingClientRect();
    this.cursor.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.ray.setFromCamera(this.cursor, this.camera);
  }

  private down = (event: PointerEvent): void => {
    if (event.button !== 0 || this.pointer !== undefined || this.contextFailed) return;
    event.preventDefault(); this.host.focus({ preventScroll: true }); this.audio.unlock();
    this.finishTidy(); this.pointer = event.pointerId; this.host.setPointerCapture(event.pointerId);
    this.point(event);
    const hit = this.ray.intersectObjects(this.toys.map(toy => toy.mesh), true)[0];
    if (hit) {
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.toy) object = object.parent;
      const toy = object?.userData.toy as LiveToy | undefined;
      if (toy) {
        const local = toy.body.pointToLocalFrame(new this.C.Vec3(hit.point.x, hit.point.y, hit.point.z));
        this.anchor.position.set(hit.point.x, hit.point.y, hit.point.z);
        const joint = new this.C.PointToPointConstraint(toy.body, local, this.anchor, new this.C.Vec3(), 900);
        joint.collideConnected = false;
        this.world.addConstraint(joint); toy.body.wakeUp();
        const normal = this.camera.getWorldDirection(new THREE.Vector3());
        this.drag = { toy, joint, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point), last: hit.point.clone(), time: performance.now(), velocity: new THREE.Vector3() };
        this.host.style.cursor = 'grabbing';
      }
    } else {
      const point = this.ray.ray.intersectPlane(this.ground, new THREE.Vector3());
      if (point) {
        this.dropPoint = point; this.drop(point);
        this.sprayStart = window.setTimeout(() => {
          if (this.pointer === undefined || !this.active()) return;
          this.sprayInterval = window.setInterval(() => {
            if (this.dropPoint && this.active()) this.drop(this.dropPoint);
          }, 180);
        }, 420);
      }
    }
    this.request();
  };

  private move = (event: PointerEvent): void => {
    if (this.pointer !== event.pointerId) return;
    this.point(event); this.lastInput = performance.now();
    if (this.drag) {
      const point = this.ray.ray.intersectPlane(this.drag.plane, new THREE.Vector3());
      if (!point) return;
      point.x = THREE.MathUtils.clamp(point.x, -6.5, 6.5);
      point.y = THREE.MathUtils.clamp(point.y, .5, 7);
      point.z = THREE.MathUtils.clamp(point.z, -4.8, 4.8);
      const time = performance.now(), elapsed = Math.max(.008, (time - this.drag.time) / 1000);
      const velocity = point.clone().sub(this.drag.last).divideScalar(elapsed);
      this.drag.velocity.lerp(velocity, .5).clampLength(0, 16);
      this.drag.last.copy(point); this.drag.time = time;
      this.anchor.position.set(point.x, point.y, point.z);
      this.anchor.velocity.setZero();
      this.drag.toy.body.wakeUp(); this.request();
    } else {
      const point = this.ray.ray.intersectPlane(this.ground, new THREE.Vector3());
      if (point) this.dropPoint = point;
    }
  };

  private release(throwing: boolean): void {
    const pointer = this.pointer;
    this.pointer = undefined;
    window.clearTimeout(this.sprayStart); window.clearInterval(this.sprayInterval);
    this.sprayStart = this.sprayInterval = 0; this.dropPoint = undefined;
    if (this.drag) {
      this.world.removeConstraint(this.drag.joint);
      if (throwing && !this.paused) {
        const freshness = Math.exp(-Math.max(0, performance.now() - this.drag.time - 60) / 110);
        const v = this.drag.velocity.clone().multiplyScalar(freshness);
        this.drag.toy.body.velocity.set(v.x, v.y, v.z);
      }
      this.drag.toy.body.wakeUp(); this.drag = undefined;
    }
    if (pointer !== undefined && this.host.hasPointerCapture(pointer)) this.host.releasePointerCapture(pointer);
    this.host.style.cursor = 'crosshair';
  }
  private up = (event: PointerEvent): void => { if (event.pointerId === this.pointer) { this.release(true); this.request(); } };
  private cancel = (): void => { this.release(false); };
  inspectObject(id: number, action: 'duplicate' | 'remove' | 'pop'): void {
    const toy = this.toys.find(item => item.body.id === id);
    if (!toy) return;
    this.audio.unlock(); this.finishTidy();
    if (action === 'duplicate') {
      const p = toy.body.position;
      const copy = this.add(toy.kind, toy.surface, THREE.MathUtils.clamp(p.x + .3, -6, 6), Math.min(6, p.y + 2), p.z);
      copy.body.quaternion.copy(toy.body.quaternion); copy.mesh.quaternion.copy(toy.mesh.quaternion);
    } else if (action === 'remove') this.retire(toy);
    else { toy.body.wakeUp(); toy.body.applyImpulse(new this.C.Vec3(0, toy.body.mass * 6, 0)); }
    this.request(); this.publish(true);
  }

  private contextMenu = (event: MouseEvent): void => {
    event.preventDefault(); this.point(event);
    this.scene.updateMatrixWorld(true);
    const hit = this.ray.intersectObjects(this.toys.map(toy => toy.mesh), true)[0];
    if (!hit) return;
    let object: THREE.Object3D | null = hit.object;
    while (object && !object.userData.toy) object = object.parent;
    const toy = object?.userData.toy as LiveToy | undefined;
    if (toy) this.onInspect?.({ id: toy.body.id, kind: toy.kind, surface: toy.surface });
  };
  private contextLost = (event: Event): void => {
    event.preventDefault(); this.contextFailed = true; this.cancel(); cancelAnimationFrame(this.frame); this.frame = 0;
    this.audio.suspend(); this.onError('The studio lost its graphics connection. Reopen Gravity to resume.');
  };

  private active(): boolean { return this.visible && !document.hidden && !this.disposed && !this.contextFailed; }
  private visibility = (): void => {
    if (!this.active()) {
      cancelAnimationFrame(this.frame); this.frame = 0; this.previous = 0;
      this.cancel(); this.audio.suspend(); this.publish(true);
    } else this.request();
  };

  private request(): void {
    this.lastInput = performance.now();
    if (this.active() && !this.frame) { this.previous = 0; this.frame = requestAnimationFrame(this.tick); }
  }

  private publish(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastStats < 400) return;
    const awake = this.toys.filter(toy => toy.body.sleepState !== this.C.Body.SLEEPING).length;
    const state = this.paused || !this.active() ? 'paused' : awake > 0 ? 'playing' : 'resting';
    const key = this.toys.length + ':' + awake + ':' + state;
    if (key !== this.statsKey) { this.statsKey = key; this.onStats({ count: this.toys.length, awake, state }); }
    this.lastStats = now;
  }

  private tick = (now: number): void => {
    this.frame = 0;
    if (!this.active()) return;
    const elapsed = this.previous ? Math.min((now - this.previous) / 1000, .05) : 1 / 60;
    this.previous = now;
    if (this.arrangements.length) this.applyTidy(Math.min(1, (now - this.tidyStarted) / 1050));
    else if (!this.paused) {
      this.world.step(1 / 60, elapsed * (this.slow ? .25 : 1), 4);
      for (const toy of this.toys) {
        const p = toy.body.interpolatedPosition, q = toy.body.interpolatedQuaternion;
        toy.mesh.position.set(p.x, p.y, p.z); toy.mesh.quaternion.set(q.x, q.y, q.z, q.w);
      }
    }
    for (const ghost of [...this.ghosts]) {
      const progress = Math.min(1, (now - ghost.started) / (this.reducedMotion ? 1 : 320));
      ghost.materials.forEach((material, i) => { material.opacity = (ghost.opacity[i] ?? 1) * (1 - progress); });
      if (progress === 1) this.removeGhost(ghost);
    }
    this.renderer.render(this.scene, this.camera);
    this.publish();
    const moving = !this.paused && this.toys.some(toy => toy.body.sleepState !== this.C.Body.SLEEPING);
    if (moving || this.drag || this.arrangements.length || this.ghosts.length || now - this.lastInput < 2000) {
      this.frame = requestAnimationFrame(this.tick);
    } else { this.previous = 0; this.publish(true); }
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.release(false);
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.observer.disconnect(); this.intersection.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
    this.host.removeEventListener('pointerdown', this.down);
    this.host.removeEventListener('pointermove', this.move);
    this.host.removeEventListener('pointerup', this.up);
    this.host.removeEventListener('pointercancel', this.cancel);
    this.host.removeEventListener('lostpointercapture', this.cancel);
    this.host.removeEventListener('contextmenu', this.contextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    for (const toy of this.toys) toy.body.removeEventListener('collide', toy.collision);
    for (const ghost of [...this.ghosts]) this.removeGhost(ghost);
    for (const constraint of [...this.world.constraints]) this.world.removeConstraint(constraint);
    for (const body of [...this.world.bodies]) this.world.removeBody(body);
    this.toys.length = 0; this.arrangements = [];
    this.factory.dispose(); this.audio.dispose();
    this.scene.environment = null; this.studioTexture?.dispose();
    for (const item of this.ownedGeometry) item.dispose();
    for (const item of this.ownedMaterials) item.dispose();
    this.light.shadow.map?.dispose();
    this.scene.clear(); this.renderer.renderLists.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
