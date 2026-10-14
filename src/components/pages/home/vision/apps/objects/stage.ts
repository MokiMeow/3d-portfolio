import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createContactShadow } from '~/experiences/home/world/scene-3.devices';
import { WindowRenderer, disposeTree } from '../nightsky/runtime';
import { loadModel, type Model, type ObjectId } from './models';
export interface StageSettings {
    rotate: boolean;
    explode: boolean;
    wireframe: boolean;
    night: boolean;
}
interface Piece {
    node: THREE.Object3D;
    position: THREE.Vector3;
    direction: THREE.Vector3;
}
interface Entry {
    id: ObjectId;
    model: Model;
    pieces: Piece[];
    materials: {
        material: THREE.Material;
        opacity: number;
        transparent: boolean;
        depthWrite: boolean;
    }[];
}
export class ObjectStage {
    readonly view: WindowRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(38, 1, .1, 40);
    private thumbCamera = new THREE.PerspectiveCamera(38, 1, .1, 30);
    private environment: THREE.WebGLRenderTarget;
    private thumbTarget = new THREE.WebGLRenderTarget(112, 112, { depthBuffer: true });
    private cache = new Map<ObjectId, Entry>();
    private pending = new Map<ObjectId, Promise<Entry>>();
    private current?: Entry;
    private outgoing?: Entry;
    private keyLight = new THREE.DirectionalLight('#fff3df', 3.8);
    private rim = new THREE.DirectionalLight('#b9ccff', 3);
    private fill = new THREE.HemisphereLight('#dae8ff', '#443629', 1.6);
    private settings: StageSettings;
    private yaw = .35;
    private targetYaw = .35;
    private pitch = .17;
    private targetPitch = .17;
    private distance = 5.5;
    private targetDistance = 5.5;
    private explode = 0;
    private explodeVelocity = 0;
    private fade = 1;
    private fadeVelocity = 0;
    private resetVelocity = new THREE.Vector3();
    private pointers = new Map<number, THREE.Vector2>();
    private pinch = 0;
    private generation = 0;
    private disposed = false;
    private preparation = new AbortController();
    private thumbnailQueue: ObjectId[] = [];
    private thumbnailTimer: ReturnType<typeof setTimeout> | undefined;
    private thumbnailsBusy = false;
    private thumbCanvas = document.createElement('canvas');
    private pixels = new Uint8Array(112 * 112 * 4);
    private thumbDone = new Set<ObjectId>();
    constructor(host: HTMLElement, compact: boolean, settings: StageSettings, private status: (message: string, failed?: boolean) => void, private thumbnail: (id: ObjectId, url: string) => void) {
        try {
            this.settings = { ...settings };
            this.view = new WindowRenderer(host, compact, (dt) => this.draw(dt), () => { this.camera.aspect = this.view.width / this.view.height; this.camera.updateProjectionMatrix(); });
            const renderer = this.view.renderer;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1;
            const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
            try {
                this.environment = pmrem.fromScene(room, .04);
            }
            finally {
                room.dispose();
                pmrem.dispose();
            }
            this.scene.environment = this.environment.texture;
            this.keyLight.position.set(3, 4, 5);
            this.rim.position.set(-4, 2, -3);
            this.scene.add(this.keyLight, this.rim, this.fill);
            const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.73, .12, 64), new THREE.MeshPhysicalMaterial({ color: '#b0c6dc', metalness: .15, roughness: .32, transparent: true, opacity: .16, clearcoat: 1, envMapIntensity: .6 }));
            pedestal.position.y = -1.5;
            this.scene.add(pedestal);
            const kit = { geometries: [] as THREE.BufferGeometry[], materials: [] as THREE.Material[], textures: [] as THREE.Texture[], envMap: this.environment.texture };
            const shadow = createContactShadow(kit, 3.4, 3.4, .45);
            shadow.position.y = -1.43;
            this.scene.add(shadow);
            this.thumbCanvas.width = this.thumbCanvas.height = 112;
            this.thumbTarget.texture.colorSpace = THREE.SRGBColorSpace;
            const canvas = renderer.domElement;
            canvas.tabIndex = 0;
            canvas.setAttribute('aria-label', '3D object viewer. Drag or use arrow keys to orbit. Plus and minus zoom. Home resets the view.');
            canvas.addEventListener('pointerdown', this.down);
            canvas.addEventListener('pointermove', this.move);
            canvas.addEventListener('pointerup', this.up);
            canvas.addEventListener('pointercancel', this.up);
            canvas.addEventListener('lostpointercapture', this.up);
            canvas.addEventListener('wheel', this.wheel, { passive: false });
            canvas.addEventListener('dblclick', this.reset);
            canvas.addEventListener('keydown', this.key);
        }
        catch (error) {
            this.dispose();
            throw error;
        }
    }
    private async get(id: ObjectId): Promise<Entry> {
        const cached = this.cache.get(id);
        if (cached) {
            this.cache.delete(id);
            this.cache.set(id, cached);
            return cached;
        }
        const pending = this.pending.get(id);
        if (pending)
            return pending;
        const promise = loadModel(id, this.environment.texture, this.preparation.signal).then(model => {
            const pieces: Piece[] = [];
            const materials = new Set<THREE.Material>();
            model.root.children.forEach((node, index) => {
                const direction = node.position.clone();
                if (direction.length() < .04)
                    direction.set(Math.sin(index * 2.4), .4 + Math.cos(index), Math.cos(index * 2.4));
                direction.normalize().multiplyScalar(.38);
                pieces.push({ node, position: node.position.clone(), direction });
            });
            model.root.traverse(node => {
                if (node instanceof THREE.Mesh)
                    for (const m of Array.isArray(node.material) ? node.material : [node.material])
                        materials.add(m);
            });
            const entry: Entry = { id, model, pieces, materials: [...materials].map(material => ({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite })) };
            if (this.disposed) {
                model.dispose();
                return entry;
            }
            this.cache.set(id, entry);
            this.trim(id);
            return entry;
        }).finally(() => this.pending.delete(id));
        this.pending.set(id, promise);
        return promise;
    }
    private trim(keep?: ObjectId): void {
        for (const [id, entry] of this.cache) {
            if (this.cache.size <= 3)
                break;
            if (id !== keep && entry !== this.current && entry !== this.outgoing) {
                entry.model.dispose();
                this.cache.delete(id);
            }
        }
    }
    async select(id: ObjectId): Promise<void> {
        const generation = ++this.generation;
        this.status('Preparing your close-up…');
        try {
            const entry = await this.get(id);
            if (this.disposed || generation !== this.generation)
                return;
            if (this.cache.get(id) !== entry) {
                void this.select(id);
                return;
            }
            if (entry === this.current) {
                this.status('');
                return;
            }
            if (this.outgoing) {
                this.scene.remove(this.outgoing.model.root);
                this.restore(this.outgoing);
            }
            this.outgoing = this.current;
            this.current = entry;
            this.scene.add(entry.model.root);
            this.restore(entry);
            this.explode = 0;
            this.explodeVelocity = 0;
            this.fade = this.view.motion.matches ? 1 : 0;
            this.fadeVelocity = 0;
            this.set(this.settings);
            this.reset();
            this.status('');
            this.view.wake();
            this.trim(id);
            if (!this.thumbDone.has(id))
                this.requestThumbnail(id);
        }
        catch {
            if (!this.disposed && generation === this.generation)
                this.status('This object is taking a rain check. Choose another, or try it again.', true);
        }
    }
    set(settings: StageSettings): void {
        this.settings = { ...settings };
        this.keyLight.intensity = settings.night ? 1.5 : 3.8;
        this.rim.intensity = settings.night ? 4 : 3;
        this.fill.intensity = settings.night ? .55 : 1.6;
        this.view.renderer.toneMappingExposure = settings.night ? .72 : 1;
        for (const entry of this.cache.values())
            for (const { material } of entry.materials)
                if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial)
                    material.wireframe = settings.wireframe;
        this.view.wake();
    }
    reset = (): void => { this.targetYaw = this.yaw + Math.atan2(Math.sin(.35 - this.yaw), Math.cos(.35 - this.yaw)); this.targetPitch = .17; this.targetDistance = 5.5; this.resetVelocity.set(0, 0, 0); this.view.wake(); };
    zoom(delta: number): void { this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + delta, 3.7, 9); this.view.wake(); }
    requestThumbnail(id: ObjectId): void {
        if (this.disposed || this.thumbDone.has(id) || this.thumbnailQueue.includes(id))
            return;
        this.thumbnailQueue.push(id);
        this.scheduleThumbnails();
    }
    private scheduleThumbnails(): void {
        if (this.disposed || !this.view.active || this.thumbnailsBusy || this.thumbnailTimer || !this.thumbnailQueue.length)
            return;
        this.thumbnailTimer = setTimeout(() => { this.thumbnailTimer = undefined; void this.renderThumbnail(); }, 120);
    }
    private async renderThumbnail(): Promise<void> {
        if (this.disposed)
            return;
        if (!this.view.active || this.pointers.size) {
            this.scheduleThumbnails();
            return;
        }
        const id = this.thumbnailQueue.shift();
        if (!id)
            return;
        this.thumbnailsBusy = true;
        try {
            const entry = await this.get(id);
            if (this.disposed)
                return;
            if (this.cache.get(id) !== entry || !this.view.active) {
                this.thumbnailQueue.push(id);
                return;
            }
            // Reuse the only renderer. A tiny render target is copied once into an offscreen 2D canvas.
            const preview = new THREE.Scene();
            preview.environment = this.environment.texture;
            const key = this.keyLight.clone(), fill = this.fill.clone(), rim = this.rim.clone();
            preview.add(key, fill, rim);
            const clone = entry.model.root.clone(true);
            clone.scale.setScalar(1);
            clone.rotation.set(0, .35, 0);
            preview.add(clone);
            // A current explosion/fade should not leak into the one-shot thumbnail.
            clone.children.forEach((node, index) => {
                const original = entry.pieces[index];
                if (original)
                    node.position.copy(original.position);
            });
            const saved = entry.materials.map(({ material }) => ({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }));
            entry.materials.forEach(({ material, opacity, transparent, depthWrite }) => { material.opacity = opacity; material.transparent = transparent; material.depthWrite = depthWrite; });
            this.thumbCamera.position.set(0, .8, 5.4);
            this.thumbCamera.lookAt(0, 0, 0);
            const renderer = this.view.renderer;
            try {
                renderer.setRenderTarget(this.thumbTarget);
                renderer.setClearColor(0, 0);
                renderer.clear();
                renderer.render(preview, this.thumbCamera);
                renderer.readRenderTargetPixels(this.thumbTarget, 0, 0, 112, 112, this.pixels);
            }
            finally {
                renderer.setRenderTarget(null);
                saved.forEach(item => { item.material.opacity = item.opacity; item.material.transparent = item.transparent; item.material.depthWrite = item.depthWrite; });
            }
            const context = this.thumbCanvas.getContext('2d');
            if (context) {
                const data = context.createImageData(112, 112);
                for (let row = 0; row < 112; row++)
                    data.data.set(this.pixels.subarray((111 - row) * 448, (112 - row) * 448), row * 448);
                context.putImageData(data, 0, 0);
                this.thumbnail(id, this.thumbCanvas.toDataURL('image/png'));
                this.thumbDone.add(id);
            }
            this.trim(this.current?.id);
            this.view.wake();
        }
        catch { /* Thumbnail failure never prevents inspecting the object itself. */ }
        finally {
            this.thumbnailsBusy = false;
            this.scheduleThumbnails();
        }
    }
    private restore(entry: Entry): void {
        entry.model.root.scale.setScalar(1);
        entry.model.root.rotation.set(0, 0, 0);
        entry.pieces.forEach(piece => piece.node.position.copy(piece.position));
        entry.materials.forEach(({ material, opacity, transparent, depthWrite }) => { material.opacity = opacity; material.transparent = transparent; material.depthWrite = depthWrite; });
    }
    private appearance(entry: Entry, amount: number, explode: number): void {
        entry.model.root.scale.setScalar(.91 + .09 * amount);
        for (const item of entry.materials) {
            const transparent = amount < .999 || item.transparent;
            if (item.material.transparent !== transparent) {
                item.material.transparent = transparent;
                item.material.needsUpdate = true;
            }
            item.material.opacity = item.opacity * THREE.MathUtils.clamp(amount, 0, 1);
            item.material.depthWrite = amount > .99 && item.depthWrite;
        }
        for (const piece of entry.pieces)
            piece.node.position.copy(piece.position).addScaledVector(piece.direction, explode);
    }
    private draw(dt: number): boolean {
        this.scheduleThumbnails();
        const reduced = this.view.motion.matches;
        if (this.settings.rotate && !this.pointers.size && !reduced)
            this.targetYaw += dt * .16;
        const targets = [this.targetYaw, this.targetPitch, this.targetDistance], values = [this.yaw, this.pitch, this.distance];
        for (let i = 0; i < 3; i++) {
            const target = targets[i]!, value = values[i]!, velocity = this.resetVelocity.getComponent(i);
            const nextVelocity = velocity + ((target - value) * 90 - velocity * 19) * dt;
            this.resetVelocity.setComponent(i, reduced ? 0 : nextVelocity);
            values[i] = reduced ? target : value + nextVelocity * dt;
        }
        [this.yaw, this.pitch, this.distance] = values as [
            number,
            number,
            number
        ];
        const targetExplode = this.settings.explode ? 1 : 0;
        this.explodeVelocity += ((targetExplode - this.explode) * 95 - this.explodeVelocity * 18) * dt;
        this.explode = reduced ? targetExplode : this.explode + this.explodeVelocity * dt;
        this.fadeVelocity += ((1 - this.fade) * 110 - this.fadeVelocity * 20) * dt;
        this.fade = reduced ? 1 : this.fade + this.fadeVelocity * dt;
        this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance, Math.sin(this.pitch) * this.distance, Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance);
        this.camera.lookAt(0, 0, 0);
        if (this.current)
            this.appearance(this.current, this.fade, this.explode);
        if (this.outgoing) {
            this.appearance(this.outgoing, 1 - this.fade, 0);
            if (this.fade > .999) {
                this.scene.remove(this.outgoing.model.root);
                this.restore(this.outgoing);
                this.outgoing = undefined;
                this.trim(this.current?.id);
            }
        }
        this.view.renderer.render(this.scene, this.camera);
        return (!reduced && this.settings.rotate && !this.pointers.size) || Math.abs(this.targetYaw - this.yaw) + Math.abs(this.targetPitch - this.pitch) + Math.abs(this.targetDistance - this.distance) + Math.abs(targetExplode - this.explode) + Math.abs(1 - this.fade) > .0005;
    }
    private down = (e: PointerEvent): void => {
        if (e.button !== 0)
            return;
        const c = this.view.renderer.domElement;
        c.setPointerCapture(e.pointerId);
        c.focus();
        this.pointers.set(e.pointerId, new THREE.Vector2(e.clientX, e.clientY));
        this.pinch = 0;
        this.view.wake();
    };
    private move = (e: PointerEvent): void => {
        const previous = this.pointers.get(e.pointerId);
        if (!previous)
            return;
        const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
        previous.set(e.clientX, e.clientY);
        if (this.pointers.size === 2) {
            const [a, b] = [...this.pointers.values()];
            const distance = a!.distanceTo(b!);
            if (this.pinch)
                this.targetDistance = THREE.MathUtils.clamp(this.targetDistance * this.pinch / Math.max(1, distance), 3.7, 9);
            this.pinch = distance;
        }
        else {
            this.targetYaw -= dx * .008;
            this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * .007, -1.2, 1.2);
        }
        this.view.wake();
    };
    private up = (e: PointerEvent): void => { this.pointers.delete(e.pointerId); this.pinch = 0; this.view.wake(); };
    private wheel = (e: WheelEvent): void => { e.preventDefault(); this.zoom(e.deltaY * .003); };
    private key = (e: KeyboardEvent): void => {
        if (e.key === 'ArrowLeft')
            this.targetYaw -= .18;
        else if (e.key === 'ArrowRight')
            this.targetYaw += .18;
        else if (e.key === 'ArrowUp')
            this.targetPitch = Math.min(1.2, this.targetPitch + .15);
        else if (e.key === 'ArrowDown')
            this.targetPitch = Math.max(-1.2, this.targetPitch - .15);
        else if (e.key === '+' || e.key === '=')
            this.zoom(-.4);
        else if (e.key === '-')
            this.zoom(.4);
        else if (e.key === 'Home')
            this.reset();
        else
            return;
        e.preventDefault();
        this.view.wake();
    };
    dispose(): void {
        this.disposed = true;
        this.preparation.abort();
        this.generation++;
        clearTimeout(this.thumbnailTimer);
        this.thumbnailQueue = [];
        const c = this.view?.renderer.domElement;
        c?.removeEventListener('pointerdown', this.down);
        c?.removeEventListener('pointermove', this.move);
        c?.removeEventListener('pointerup', this.up);
        c?.removeEventListener('pointercancel', this.up);
        c?.removeEventListener('lostpointercapture', this.up);
        c?.removeEventListener('wheel', this.wheel);
        c?.removeEventListener('dblclick', this.reset);
        c?.removeEventListener('keydown', this.key);
        this.pointers.clear();
        this.cache.forEach(entry => entry.model.dispose());
        this.cache.clear();
        disposeTree(this.scene, this.environment?.texture);
        this.scene.environment = null;
        this.environment?.dispose();
        this.thumbTarget.dispose();
        this.thumbCanvas.width = this.thumbCanvas.height = 0;
        this.view?.dispose();
    }
}
