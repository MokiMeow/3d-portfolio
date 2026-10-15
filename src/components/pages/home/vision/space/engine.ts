import * as THREE from 'three';
import { decoded } from '../textures';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { make, makeMaterials } from './shapes';
import type { MaterialId, ShapeId } from './shapes';

/**
 * Things made in the space around you. A transparent layer between the place and your windows: real
 * physics, soft shadows on an invisible floor, and reflections of wherever you are. Its camera follows
 * the environment's, so objects stay put in the world when you look around.
 */
export type GravityMode = 'earth' | 'moon' | 'mars' | 'zero';
export const GRAVITY: Record<GravityMode, { g: number; name: string }> = { earth: { g: -9.82, name: 'Earth' }, moon: { g: -1.62, name: 'Moon' }, mars: { g: -3.72, name: 'Mars' }, zero: { g: 0, name: 'Zero-G' } };
type View = { yaw: number; pitch: number; fov: number };
/** A thing in the space. A model (dragged out of the Mac) rides on `mesh`, an invisible box that carries its physics. */
export type Thing = { id: number; shape: ShapeId; material: MaterialId; size: number; mesh: THREE.Mesh; body: CANNON.Body; born: number; dying?: number; wire?: THREE.LineSegments; model?: { name: string; dispose: () => void; ref?: string } };
export type Structure = 'tower' | 'pyramid' | 'dominoes' | 'wall' | 'stairs' | 'circle';

// Eye height above the floor, and how far out things are made: far enough to sit in the lower third of the view.
const FLOOR = -1.05;
const REACH = 2.5;
const MAX = 90;

export class SpaceEngine {
  readonly things: Thing[] = [];
  onChange: () => void = () => {};
  gravity: GravityMode = 'earth';
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(72, 1, .05, 200);
  private world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY.earth.g, 0), allowSleep: true });
  private materials: ReturnType<typeof makeMaterials>;
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private roomEnv: THREE.WebGLRenderTarget;
  private spaceEnv: THREE.WebGLRenderTarget;
  private grid: THREE.Mesh;
  private gridHolder = new THREE.Group();
  private gridMaterial: THREE.ShaderMaterial;
  private rings: { mesh: THREE.Mesh; born: number }[] = [];
  private ringGeometry = new THREE.RingGeometry(.92, 1, 64);
  private hand = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
  private grip: { thing: Thing; constraint: CANNON.PointToPointConstraint; depth: number; trail: { p: THREE.Vector3; t: number }[] } | null = null;
  private frame = 0;
  /** True while the loop is only watching the view between frames, not stepping the world. */
  private idling = false;
  private last = 0;
  private lastView = { yaw: 9, pitch: 9, fov: 0, w: 0, h: 0 };
  private nextId = 1;
  private observer: ResizeObserver;
  private envUrl = '';
  showGrid = false;

  constructor(private canvas: HTMLCanvasElement, private view: () => View) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    // Full-view and transparent, so every pixel counts: sharp enough at 1.5x, and no sharper.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.debug.checkShaderErrors = Boolean(import.meta.dev);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.roomEnv = this.pmrem.fromScene(new RoomEnvironment(), .04);
    this.scene.environment = this.roomEnv.texture;
    const space = new THREE.Scene();
    space.background = new THREE.Color('#020203');
    // A dome lit from below the horizon by sunlit ground, so metal has something bright to reflect.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 ground = vec3(.62, .6, .57); vec3 horizon = vec3(.16, .17, .2); vec3 sky = vec3(.01); gl_FragColor = vec4(h < 0. ? mix(horizon, ground, smoothstep(0., -.35, h)) : mix(horizon, sky, smoothstep(0., .25, h)), 1.); }' }));
    space.add(dome);
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.6, 8) }));
    sunDisc.position.set(-8, 4, 3);
    const regolith = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: '#9a9690' }));
    regolith.rotation.x = -Math.PI / 2; regolith.position.y = -3;
    space.add(sunDisc, regolith);
    this.spaceEnv = this.pmrem.fromScene(space, .02);
    sunDisc.geometry.dispose(); (sunDisc.material as THREE.Material).dispose(); regolith.geometry.dispose(); (regolith.material as THREE.Material).dispose(); dome.geometry.dispose(); (dome.material as THREE.Material).dispose();
    this.materials = makeMaterials();

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b6158', .55));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
    sun.position.set(2.5, 6, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -5; sun.shadow.camera.right = sun.shadow.camera.top = 5;
    sun.shadow.camera.near = .5; sun.shadow.camera.far = 20;
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; sun.shadow.radius = 5;
    this.scene.add(sun, sun.target);
    sun.target.position.set(0, FLOOR, -REACH);

    // A floor you cannot see, only the shadows on it.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.ShadowMaterial({ color: '#000', opacity: .34 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true;
    this.scene.add(floor);
    // The placement grid while creating: dots on the floor, fading out from where you will build.
    this.gridMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */`uniform float uOpacity, uTime; varying vec2 vP;
        void main(){ vec2 c = vP - vec2(0., 2.5); float r = length(c);
          vec2 g = abs(fract(vP * 4.) - .5); float dot = smoothstep(.09, .03, length(g));
          float f = fract(r * 1.2 - uTime * .25); float ring = smoothstep(.035, 0., min(f, 1. - f));
          float fade = smoothstep(3.2, .4, r);
          gl_FragColor = vec4(vec3(1., .86, .6), (dot * .5 + ring * .25) * fade * uOpacity); }`,
    });
    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), this.gridMaterial);
    this.grid.rotation.x = -Math.PI / 2; this.grid.position.y = FLOOR + .002;
    this.gridHolder.add(this.grid);
    this.scene.add(this.gridHolder);

    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.position.y = FLOOR;
    this.world.addBody(ground);
    this.world.addBody(this.hand);
    this.world.defaultContactMaterial.friction = .45;
    this.world.defaultContactMaterial.restitution = .28;
    (this.world.solver as CANNON.GSSolver).iterations = 12;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  /** Reflections from the place you are in: its panorama, or a soft studio for the room and space. */
  setEnvironment(url: string | null) {
    if (url === this.envUrl) return;
    this.envUrl = url ?? '';
    if (!url || url === 'space') { this.scene.environment = url === 'space' ? this.spaceEnv.texture : this.roomEnv.texture; this.wake(); return; }
    new THREE.TextureLoader().load(url, async texture => {
      await decoded(texture.image);
      if (this.envUrl !== url) { texture.dispose(); return; }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      const target = this.pmrem.fromEquirectangular(texture);
      texture.dispose();
      this.envTarget?.dispose();
      this.envTarget = target;
      this.scene.environment = target.texture;
      this.wake();
    });
  }

  /** Lay the placement grid out in the direction you are facing. */
  aimGrid() { this.gridHolder.rotation.y = this.view().yaw; this.wake(); }

  setGravity(mode: GravityMode) {
    this.gravity = mode;
    this.world.gravity.set(0, GRAVITY[mode].g, 0);
    for (const thing of this.things) { thing.body.wakeUp(); if (mode === 'zero') thing.body.applyImpulse(new CANNON.Vec3((Math.random() - .5) * .3, .25 + Math.random() * .3, (Math.random() - .5) * .3).scale(thing.body.mass)); }
    this.wake(); this.onChange();
  }

  /** A point straight out from the screen at a given distance. */
  ray(x: number, y: number) {
    this.sync();
    const ndc = new THREE.Vector2(x / this.canvas.clientWidth * 2 - 1, -(y / this.canvas.clientHeight) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    return raycaster;
  }
  /** Where a click lands: on the floor if it is near enough, otherwise in the air at arm's length. */
  placeAt(x: number, y: number, size: number) {
    const ray = this.ray(x, y).ray;
    const t = ray.direction.y < -.05 ? (FLOOR + size * .5 - ray.origin.y) / ray.direction.y : Infinity;
    const point = t > .8 && t < 6 ? ray.at(t, new THREE.Vector3()).add(new THREE.Vector3(0, size * .8, 0)) : ray.at(REACH, new THREE.Vector3());
    point.y = Math.max(FLOOR + size * .6, point.y);
    return point;
  }
  /** Somewhere in front of you, a little above the floor, for things made by voice. */
  inFront(spread = 0) {
    const { yaw } = this.view();
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    return dir.multiplyScalar(REACH + (Math.random() - .5) * spread * .5).add(side.multiplyScalar((Math.random() - .5) * spread)).setY(-.2 + Math.random() * spread * .4);
  }

  private wireMaterial = new THREE.LineBasicMaterial({ color: '#ffc15a', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  spawn(shape: ShapeId, material: MaterialId, size: number, at: THREE.Vector3, options: { drawn?: THREE.Shape; velocity?: THREE.Vector3; spin?: boolean; yaw?: number; fabricate?: boolean } = {}) {
    const made = make(shape, size, options.drawn);
    const mesh = new THREE.Mesh(made.geometry, this.materials.materials[material]);
    mesh.castShadow = material !== 'glass'; mesh.receiveShadow = true;
    if (options.drawn) mesh.userData.drawn = options.drawn;
    const body = new CANNON.Body({ mass: Math.max(.02, made.mass), position: new CANNON.Vec3(at.x, at.y, at.z), linearDamping: .04, angularDamping: .08, sleepSpeedLimit: .12, sleepTimeLimit: .6 });
    for (const part of made.shapes) body.addShape(part.shape, part.offset, part.orientation);
    if (options.spin !== false) body.quaternion.setFromEuler(Math.random() * .6, Math.random() * Math.PI * 2, Math.random() * .6);
    else if (options.yaw) body.quaternion.setFromEuler(0, options.yaw, 0);
    if (options.velocity) body.velocity.set(options.velocity.x, options.velocity.y, options.velocity.z);
    if (this.gravity === 'zero') body.angularVelocity.set((Math.random() - .5) * .6, (Math.random() - .5) * .6, (Math.random() - .5) * .6);
    this.world.addBody(body);
    mesh.scale.setScalar(.001);
    this.scene.add(mesh);
    const thing: Thing = { id: this.nextId++, shape, material, size, mesh, body, born: performance.now() };
    // Fabrication: a gold wireframe first, the solid filling in behind it, the way JARVIS builds things.
    if (options.fabricate) {
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(made.geometry, 25), this.wireMaterial.clone());
      this.scene.add(wire);
      thing.wire = wire;
      mesh.visible = false;
    }
    this.things.push(thing);
    this.ring(at, size);
    // Oldest first, when the space gets crowded.
    while (this.things.filter(item => !item.dying).length > MAX) this.remove(this.things.find(item => !item.dying)!);
    this.wake(); this.onChange();
    return thing;
  }

  /** A whole model, placed in the space with a body the shape of its bounding box. */
  spawnModel(root: THREE.Object3D, name: string, dispose: () => void, at: THREE.Vector3, height = .42, ref?: string) {
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(size.y, .001);
    root.scale.multiplyScalar(scale); root.position.sub(centre.multiplyScalar(scale));
    size.multiplyScalar(scale);
    root.traverse(node => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const proxy = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    proxy.add(root);
    const body = new CANNON.Body({ mass: 1.2, position: new CANNON.Vec3(at.x, Math.max(at.y, FLOOR + size.y / 2 + .02), at.z), linearDamping: .05, angularDamping: .2, sleepSpeedLimit: .12, sleepTimeLimit: .6 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    const { yaw } = this.view();
    body.quaternion.setFromEuler(0, yaw, 0);
    this.world.addBody(body);
    proxy.scale.setScalar(.001);
    this.scene.add(proxy);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), this.wireMaterial.clone());
    this.scene.add(wire);
    proxy.visible = false;
    const thing: Thing = { id: this.nextId++, shape: 'cube', material: 'glass', size: Math.max(size.x, size.y, size.z), mesh: proxy, body, born: performance.now(), wire, model: { name, dispose, ref } };
    this.things.push(thing);
    this.ring(new THREE.Vector3(at.x, body.position.y, at.z), thing.size);
    while (this.things.filter(item => !item.dying).length > MAX) this.remove(this.things.find(item => !item.dying)!);
    this.wake(); this.onChange();
    return thing;
  }
  /** Compiles every finish's shaders in the background, so the first cube of each appears without a stall. */
  prewarm() {
    const geometry = new THREE.BoxGeometry(.01, .01, .01), group = new THREE.Group();
    for (const material of Object.values(this.materials.materials)) { const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; group.add(mesh); }
    group.position.set(0, -40, 0);
    this.scene.add(group);
    void this.renderer.compileAsync(this.scene, this.camera).catch(() => undefined).finally(() => { this.scene.remove(group); geometry.dispose(); });
  }
  /** Compiles a model's shaders before it is placed. */
  prepare(root: THREE.Object3D) { return this.renderer.compileAsync(root, this.camera, this.scene).catch(() => undefined); }
  /** The light the space is lit by, for models brought in from elsewhere. */
  get envMap() { return this.scene.environment; }

  /** A gold ring that flares where something materialises. */
  private ring(at: THREE.Vector3, size: number) {
    const material = new THREE.MeshBasicMaterial({ color: '#ffc15a', transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(this.ringGeometry, material);
    mesh.position.copy(at); mesh.scale.setScalar(size * .6);
    mesh.lookAt(this.camera.position);
    this.scene.add(mesh);
    this.rings.push({ mesh, born: performance.now() });
  }

  /** A shove, for the first domino. */
  nudge(thing: Thing, direction: THREE.Vector3, strength = 1) {
    thing.body.wakeUp();
    thing.body.applyImpulse(new CANNON.Vec3(direction.x, direction.y, direction.z).scale(thing.body.mass * strength), new CANNON.Vec3(thing.body.position.x, thing.body.position.y + thing.size * .35, thing.body.position.z));
    this.wake();
  }
  /** Where to build: on the ground in front of you, facing you. */
  site(distance = 2.3) {
    const { yaw } = this.view();
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(-forward.z, 0, forward.x);
    return { origin: forward.clone().multiplyScalar(distance).setY(FLOOR), forward, right, yaw };
  }
  get floor() { return FLOOR; }

  remove(thing: Thing) { if (!thing.dying) { thing.dying = performance.now(); this.world.removeBody(thing.body); this.wake(); this.onChange(); } }
  clear() { [...this.things].forEach(thing => this.remove(thing)); }
  get count() { return this.things.filter(thing => !thing.dying).length; }

  pick(x: number, y: number) {
    const hits = this.ray(x, y).intersectObjects(this.things.filter(thing => !thing.dying).map(thing => thing.mesh), false);
    const hit = hits[0];
    return hit ? { thing: this.things.find(thing => thing.mesh === hit.object)!, point: hit.point, distance: hit.distance } : undefined;
  }
  grab(x: number, y: number) {
    const hit = this.pick(x, y);
    if (!hit) return undefined;
    const body = hit.thing.body;
    body.wakeUp();
    const local = body.quaternion.inverse().vmult(new CANNON.Vec3(hit.point.x, hit.point.y, hit.point.z).vsub(body.position));
    this.hand.position.set(hit.point.x, hit.point.y, hit.point.z);
    const constraint = new CANNON.PointToPointConstraint(body, local, this.hand, new CANNON.Vec3(), Math.max(4, body.mass * 40));
    this.world.addConstraint(constraint);
    body.angularDamping = .6;
    this.grip = { thing: hit.thing, constraint, depth: hit.distance, trail: [{ p: hit.point.clone(), t: performance.now() }] };
    this.wake();
    return hit.thing;
  }
  drag(x: number, y: number, depthDelta = 0) {
    if (!this.grip) return;
    this.grip.depth = Math.max(.7, Math.min(4, this.grip.depth + depthDelta));
    const point = this.ray(x, y).ray.at(this.grip.depth, new THREE.Vector3());
    point.y = Math.max(FLOOR + .05, point.y);
    this.hand.position.set(point.x, point.y, point.z);
    this.grip.trail.push({ p: point, t: performance.now() });
    if (this.grip.trail.length > 6) this.grip.trail.shift();
    this.wake();
  }
  /** Let go: the object keeps the speed of your hand, so a flick throws it. */
  release() {
    if (!this.grip) return;
    const { thing, constraint, trail } = this.grip;
    this.world.removeConstraint(constraint);
    thing.body.angularDamping = .08;
    const first = trail[0]!, last = trail[trail.length - 1]!, dt = Math.max(.016, (last.t - first.t) / 1000);
    if (trail.length > 1 && performance.now() - last.t < 120) {
      const v = last.p.clone().sub(first.p).divideScalar(dt).clampLength(0, 9);
      thing.body.velocity.set(v.x, v.y, v.z);
    }
    this.grip = null;
    this.wake();
  }
  get holding() { return this.grip?.thing; }

  /** Screen position of a thing, for its little ornament. */
  project(thing: Thing) {
    this.sync();
    const p = thing.mesh.position.clone().add(new THREE.Vector3(0, thing.size * .75, 0)).project(this.camera);
    return { x: (p.x + 1) / 2 * this.canvas.clientWidth, y: (1 - p.y) / 2 * this.canvas.clientHeight, visible: p.z < 1 };
  }
  restyle(thing: Thing, material: MaterialId) { if (thing.model) return; thing.material = material; thing.mesh.material = this.materials.materials[material]; thing.mesh.castShadow = material !== 'glass'; this.wake(); }
  resize_thing(thing: Thing, factor: number) {
    // A model grows as a whole: its picture, its hit box and its body together.
    if (thing.model) {
      const f = Math.max(.15, Math.min(1.6, thing.size * factor)) / thing.size;
      thing.mesh.geometry.scale(f, f, f);
      thing.mesh.children.forEach(child => { child.scale.multiplyScalar(f); child.position.multiplyScalar(f); });
      const box = thing.body.shapes[0] as CANNON.Box;
      box.halfExtents.scale(f, box.halfExtents); box.updateConvexPolyhedronRepresentation(); box.updateBoundingSphereRadius();
      thing.body.updateBoundingRadius(); thing.body.aabbNeedsUpdate = true;
      thing.size *= f; thing.body.wakeUp(); this.wake();
      return;
    }
    const next = Math.max(.08, Math.min(1.2, thing.size * factor));
    const made = make(thing.shape, next, thing.shape === 'drawn' ? (thing.mesh.userData.drawn as THREE.Shape) : undefined);
    thing.mesh.geometry.dispose(); thing.mesh.geometry = made.geometry;
    while (thing.body.shapes.length) thing.body.removeShape(thing.body.shapes[0]!);
    for (const part of made.shapes) thing.body.addShape(part.shape, part.offset, part.orientation);
    thing.body.mass = Math.max(.02, made.mass); thing.body.updateMassProperties();
    thing.size = next; thing.body.wakeUp(); this.wake();
  }

  private sync() {
    const { yaw, pitch, fov } = this.view();
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.updateMatrixWorld();
  }
  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.wake();
  }

  /** Runs only while something is moving, being made, or the view is turning. */
  wake() {
    // Running already. An idle watch does not count: it would never step what just changed.
    if (this.frame && !this.idling) return;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.idling = false;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }
  private tick = (now: number) => {
    this.frame = 0;
    const dt = Math.min(.05, (now - this.last) / 1000);
    this.last = now;
    if (document.hidden) { this.frame = requestAnimationFrame(this.tick); return; }
    this.world.step(1 / 60, dt, 4);
    let busy = Boolean(this.grip) || this.showGrid || this.gridMaterial.uniforms.uOpacity!.value > .001;
    for (const thing of [...this.things]) {
      const age = (now - thing.born) / 1000;
      // Keep things within reach: a gentle pull back if they roll too far away or too close.
      const p = thing.body.position, flat = Math.hypot(p.x, p.z);
      if (!thing.dying && (flat > 5.5 || flat < 1.1)) { const k = flat > 5.5 ? -1 : 1; thing.body.applyForce(new CANNON.Vec3(p.x / flat * k * thing.body.mass * 6, 0, p.z / flat * k * thing.body.mass * 6)); }
      if (!thing.dying && p.y < FLOOR - 1) { p.set(p.x * .5, FLOOR + 1, p.z * .5); thing.body.velocity.setZero(); }
      thing.mesh.position.set(p.x, p.y, p.z);
      thing.mesh.quaternion.set(thing.body.quaternion.x, thing.body.quaternion.y, thing.body.quaternion.z, thing.body.quaternion.w);
      let scale = 1;
      if (age < .5) { const t = age / .5; scale = 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2); busy = true; }
      if (thing.dying) {
        const t = (now - thing.dying) / 380;
        scale = Math.max(.001, 1 - t);
        busy = true;
        if (t >= 1) { this.scene.remove(thing.mesh); thing.mesh.geometry.dispose(); thing.model?.dispose(); this.things.splice(this.things.indexOf(thing), 1); continue; }
      }
      if (thing.wire) {
        const t = age / 1.1;
        if (age > .42) thing.mesh.visible = true;
        thing.wire.position.copy(thing.mesh.position); thing.wire.quaternion.copy(thing.mesh.quaternion);
        thing.wire.scale.setScalar(Math.min(1, age / .3) * (1 + Math.max(0, .42 - age)));
        (thing.wire.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - Math.max(0, t - .3) / .7);
        if (age > .42) scale = Math.min(scale, .6 + (age - .42) * 2);
        if (t >= 1 || thing.dying) { this.scene.remove(thing.wire); thing.wire.geometry.dispose(); (thing.wire.material as THREE.Material).dispose(); thing.wire = undefined; thing.mesh.visible = true; }
        busy = true;
      }
      thing.mesh.scale.setScalar(scale);
      if (!thing.dying && thing.body.sleepState !== CANNON.Body.SLEEPING) busy = true;
    }
    for (const ring of [...this.rings]) {
      const t = (now - ring.born) / 650;
      ring.mesh.scale.multiplyScalar(1 + dt * 3.2);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, .9 * (1 - t));
      if (t >= 1) { this.scene.remove(ring.mesh); (ring.mesh.material as THREE.Material).dispose(); this.rings.splice(this.rings.indexOf(ring), 1); }
      busy = true;
    }
    const target = this.showGrid ? 1 : 0, grid = this.gridMaterial.uniforms.uOpacity!;
    grid.value += (target - grid.value) * Math.min(1, dt * 6);
    this.gridMaterial.uniforms.uTime!.value = now / 1000;
    const { yaw, pitch, fov } = this.view();
    const moved = Math.abs(yaw - this.lastView.yaw) > 1e-4 || Math.abs(pitch - this.lastView.pitch) > 1e-4 || fov !== this.lastView.fov || this.canvas.width !== this.lastView.w;
    if (moved) { this.lastView = { yaw, pitch, fov, w: this.canvas.width, h: this.canvas.height }; busy = true; }
    this.sync();
    this.renderer.render(this.scene, this.camera);
    // While there is anything at all in the space, keep watching for the view to turn; otherwise rest.
    this.idling = !busy;
    if (busy || this.things.length || this.showGrid) this.frame = requestAnimationFrame(busy ? this.tick : this.idle);
    else this.idling = false;
  };
  /** Cheap check between frames when everything is still: only redraw if the view has turned. */
  private idle = (now: number) => {
    const { yaw, pitch, fov } = this.view();
    if (Math.abs(yaw - this.lastView.yaw) > 1e-4 || Math.abs(pitch - this.lastView.pitch) > 1e-4 || fov !== this.lastView.fov) { this.idling = false; this.last = now - 16; this.tick(now); return; }
    this.frame = requestAnimationFrame(this.idle);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    for (const thing of this.things) { thing.mesh.geometry.dispose(); thing.model?.dispose(); }
    Object.values(this.materials.materials).forEach(material => material.dispose());
    this.materials.textures.forEach(texture => texture.dispose());
    this.envTarget?.dispose(); this.roomEnv.dispose(); this.spaceEnv.dispose(); this.pmrem.dispose();
    this.ringGeometry.dispose(); this.grid.geometry.dispose(); this.gridMaterial.dispose(); this.wireMaterial.dispose();
    this.renderer.dispose();
  }
}
