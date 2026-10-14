import * as THREE from 'three';
import { stars, constellations, type SkyObject } from './catalog';
import { cities, equatorial, observerMatrix, planets, RAD } from './astronomy';
import { WindowRenderer, disposeTree } from './runtime';
export interface SkyState {
    time: number;
    city: number;
    lines: boolean;
    labels: boolean;
    ground: boolean;
    planets: boolean;
    playing: boolean;
}
interface Label {
    node: HTMLSpanElement;
    position: THREE.Vector3;
    kind: 'star' | 'constellation' | 'planet' | 'cardinal';
}
export class Planetarium {
    readonly view: WindowRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(62, 1, .1, 150);
    private sphere = new THREE.Group();
    private state: SkyState;
    private labels: Label[] = [];
    private line: THREE.LineSegments;
    private ground: THREE.Mesh;
    private starMaterial: THREE.ShaderMaterial;
    private planetary = new THREE.Group();
    private objects: SkyObject[] = [];
    private yaw = 0;
    private pitch = .55;
    private targetYaw = 0;
    private targetPitch = .55;
    private fov = 62;
    private vx = 0;
    private vy = 0;
    private pointers = new Map<number, THREE.Vector2>();
    private start = new THREE.Vector2();
    private travelled = 0;
    private pinch = 0;
    private lastSkyTime = 0;
    private projection = new THREE.Vector3();
    private forward = new THREE.Vector3();
    private picked = new THREE.Vector3();
    private labelLayer: HTMLDivElement;
    private planetGeometry = new THREE.BufferGeometry();
    private planetMaterial: THREE.ShaderMaterial;
    constructor(host: HTMLElement, compact: boolean, initial: SkyState, private select: (object: SkyObject) => void, private advance: (milliseconds: number) => void) {
        try {
            this.state = { ...initial };
            this.scene.add(this.sphere);
            const positions: number[] = [], colours: number[] = [], magnitudes: number[] = [], phases: number[] = [];
            let seed = 417;
            const random = (): number => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
            const pole = equatorial(12.8595, 27.1283, 1);
            const u = new THREE.Vector3(0, 1, 0).cross(pole).normalize(), v = pole.clone().cross(u).normalize();
            const add = (p: THREE.Vector3, magnitude: number, bv: number): void => {
                positions.push(p.x, p.y, p.z);
                magnitudes.push(magnitude);
                phases.push(random() * 6.283);
                const t = THREE.MathUtils.clamp((bv + .3) / 2.2, 0, 1);
                const colour = new THREE.Color().lerpColors(new THREE.Color('#a7c6ff'), new THREE.Color('#ffb16d'), t);
                colours.push(colour.r, colour.g, colour.b);
            };
            for (const star of stars)
                add(equatorial(star.ra, star.dec), star.magnitude, star.bv);
            for (let i = stars.length; i < 4800; i++) {
                let p: THREE.Vector3;
                if (random() < .65) {
                    const a = random() * 6.283, latitude = (random() + random() + random() - 1.5) * .21;
                    p = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).multiplyScalar(Math.cos(latitude)).addScaledVector(pole, Math.sin(latitude)).multiplyScalar(100);
                }
                else
                    p = equatorial(random() * 24, Math.asin(random() * 2 - 1) / RAD);
                add(p, 4.5 + random() * 2.4, random() * 1.7 - .2);
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
            geometry.setAttribute('magnitude', new THREE.Float32BufferAttribute(magnitudes, 1));
            geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
            this.starMaterial = new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
                uniforms: { time: { value: 0 }, ratio: { value: 1 }, zoom: { value: 1 }, twinkle: { value: 1 } },
                vertexShader: 'attribute vec3 color; attribute float magnitude; attribute float phase; uniform float time; uniform float ratio; uniform float zoom; uniform float twinkle; varying vec3 tint; varying float light; void main(){ tint=color; light=clamp(pow(2.512,-magnitude*.28)*2.1,.5,3.)*(1.+twinkle*.08*sin(time*.75+phase)); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=clamp((8.6-magnitude*.95)*ratio*zoom,2.2,26.); }',
                fragmentShader: 'varying vec3 tint; varying float light; void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; float core=exp(-d*d*14.); float halo=exp(-d*d*3.5)*.35; gl_FragColor=vec4(mix(tint,vec3(1.),core*.55),(core+halo)*light);}',
            });
            this.sphere.add(new THREE.Points(geometry, this.starMaterial));
            const segments: number[] = [];
            const byName = new Map(stars.map(star => [star.name, star]));
            for (const constellation of constellations)
                for (const path of constellation.paths)
                    for (let i = 1; i < path.length; i++) {
                        const a = byName.get(path[i - 1]!), b = byName.get(path[i]!);
                        if (!a || !b)
                            continue;
                        const from = equatorial(a.ra, a.dec), to = equatorial(b.ra, b.dec);
                        for (let j = 0; j < 8; j++)
                            for (const t of [j / 8, (j + 1) / 8]) {
                                const p = from.clone().lerp(to, t).normalize().multiplyScalar(99);
                                segments.push(p.x, p.y, p.z);
                            }
                    }
            this.line = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments, 3)), new THREE.LineBasicMaterial({ color: '#91a8ed', transparent: true, opacity: .28, depthWrite: false }));
            this.sphere.add(this.line);
            const glow = new THREE.Mesh(new THREE.SphereGeometry(110, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
                uniforms: { pole: { value: pole } }, vertexShader: 'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
                fragmentShader: 'varying vec3 direction; uniform vec3 pole; void main(){vec3 p=normalize(direction);float b=abs(dot(p,pole));float n=.65+.2*sin(p.x*32.+sin(p.z*18.))+.15*sin(p.y*66.+p.z*24.);float a=exp(-b*b*70.)*n*.17;gl_FragColor=vec4(.38,.40,.69,a);}' }));
            this.sphere.add(glow);
            this.ground = new THREE.Mesh(new THREE.SphereGeometry(90, 40, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false,
                vertexShader: 'varying float altitude;void main(){altitude=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
                fragmentShader: 'varying float altitude;void main(){if(altitude>.13)discard;float a=altitude<0.?1.:exp(-altitude*40.)*.38;vec3 c=mix(vec3(.018,.022,.038),vec3(.10,.13,.23),exp(-abs(altitude)*24.));gl_FragColor=vec4(c,a);}' }));
            this.ground.renderOrder = 4;
            this.scene.add(this.ground);
            this.planetMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ratio: { value: 1 } },
                vertexShader: 'attribute vec3 color;attribute float size;uniform float ratio;varying vec3 tint;void main(){tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*ratio;}',
                fragmentShader: 'varying vec3 tint;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint,exp(-d*d*5.));}' });
            this.planetary.add(new THREE.Points(this.planetGeometry, this.planetMaterial));
            this.sphere.add(this.planetary);
            this.labelLayer = document.createElement('div');
            this.labelLayer.className = 'sky-labels';
            host.appendChild(this.labelLayer);
            const label = (name: string, position: THREE.Vector3, kind: Label['kind']): void => {
                const node = document.createElement('span');
                node.textContent = name;
                node.hidden = true;
                node.className = 'sky-label ' + kind;
                this.labelLayer.appendChild(node);
                this.labels.push({ node, position, kind });
            };
            for (const item of constellations)
                label(item.name, equatorial(item.ra, item.dec), 'constellation');
            for (const star of stars.filter(s => s.magnitude < .9 || s.name === 'Polaris'))
                label(star.name, equatorial(star.ra, star.dec), 'star');
            for (const [name, x, z] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]] as const)
                label(name, new THREE.Vector3(x, .015, z).multiplyScalar(85), 'cardinal');
            this.updateSky();
            this.view = new WindowRenderer(host, compact, (dt, t) => this.draw(dt, t), () => { this.camera.aspect = this.view.width / this.view.height; this.camera.updateProjectionMatrix(); });
            const canvas = this.view.renderer.domElement;
            canvas.tabIndex = 0;
            canvas.setAttribute('aria-label', 'Interactive planetarium. Drag or use arrow keys to look. Plus and minus zoom. Search to select an object.');
            canvas.addEventListener('pointerdown', this.down);
            canvas.addEventListener('pointermove', this.move);
            canvas.addEventListener('pointerup', this.up);
            canvas.addEventListener('pointercancel', this.cancel);
            canvas.addEventListener('lostpointercapture', this.cancel);
            canvas.addEventListener('wheel', this.wheel, { passive: false });
            canvas.addEventListener('keydown', this.key);
        }
        catch (error) {
            this.dispose();
            throw error;
        }
    }
    set(state: SkyState): void { this.state = { ...state }; this.updateSky(); this.view.wake(); }
    private updateSky(): void {
        const city = cities[this.state.city] ?? cities[0];
        this.sphere.matrix.copy(observerMatrix(this.state.time, city.lat, city.lon));
        this.sphere.matrixAutoUpdate = false;
        this.sphere.updateMatrixWorld(true);
        this.objects = planets(this.state.time);
        this.lastSkyTime = this.state.time;
        const p: number[] = [], c: number[] = [], sizes: number[] = [];
        const colors = ['#f5efdf', '#e4d2ab', '#fff4d2', '#ff9966', '#f4d8b3', '#ead4a0'];
        this.objects.forEach((object, i) => { const pos = equatorial(object.ra, object.dec, 98); p.push(pos.x, pos.y, pos.z); const color = new THREE.Color(colors[i]); c.push(color.r, color.g, color.b); sizes.push(i === 0 ? 20 : i === 2 ? 13 : 10); });
        this.planetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        this.planetGeometry.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
        this.planetGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        this.planetGeometry.computeBoundingSphere();
        for (const object of this.objects) {
            const existing = this.labels.find(label => label.kind === 'planet' && label.node.textContent === object.name);
            if (existing) {
                existing.position.copy(equatorial(object.ra, object.dec, 98));
                continue;
            }
            const node = document.createElement('span');
            node.textContent = object.name;
            node.hidden = true;
            node.className = 'sky-label planet';
            this.labelLayer.appendChild(node);
            this.labels.push({ node, position: equatorial(object.ra, object.dec, 98), kind: 'planet' });
        }
        this.line.visible = this.state.lines;
        this.ground.visible = this.state.ground;
        this.planetary.visible = this.state.planets;
    }
    fly(object: SkyObject): boolean {
        const city = cities[this.state.city] ?? cities[0];
        const p = equatorial(object.ra, object.dec, 1).applyMatrix4(observerMatrix(this.state.time, city.lat, city.lon));
        const yaw = Math.atan2(p.x, -p.z);
        this.targetYaw = this.yaw + Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
        this.targetPitch = Math.asin(p.y);
        this.vx = this.vy = 0;
        this.view.wake();
        return p.y < 0;
    }
    private draw(dt: number, time: number): boolean {
        const reduced = this.view.motion.matches;
        if (this.state.playing) {
            this.state.time += dt * 3600000;
            this.advance(dt * 3600000);
            if (Math.abs(this.state.time - this.lastSkyTime) > 600000)
                this.updateSky();
            const city = cities[this.state.city] ?? cities[0];
            this.sphere.matrix.copy(observerMatrix(this.state.time, city.lat, city.lon));
            this.sphere.updateMatrixWorld(true);
        }
        if (!this.pointers.size && !reduced) {
            this.targetYaw += this.vx * dt;
            this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + this.vy * dt, -1.53, 1.53);
            this.vx *= Math.exp(-dt * 5);
            this.vy *= Math.exp(-dt * 5);
        }
        const ease = reduced ? 1 : 1 - Math.exp(-dt * 10);
        this.yaw += (this.targetYaw - this.yaw) * ease;
        this.pitch += (this.targetPitch - this.pitch) * ease;
        this.camera.fov += (this.fov - this.camera.fov) * ease;
        this.camera.updateProjectionMatrix();
        this.camera.lookAt(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.updateMatrixWorld();
        this.camera.getWorldDirection(this.forward);
        this.starMaterial.uniforms.time!.value = time;
        this.starMaterial.uniforms.twinkle!.value = reduced ? 0 : 1;
        this.starMaterial.uniforms.ratio!.value = this.view.renderer.getPixelRatio();
        this.starMaterial.uniforms.zoom!.value = 62 / this.camera.fov;
        this.planetMaterial.uniforms.ratio!.value = this.view.renderer.getPixelRatio();
        for (const label of this.labels) {
            const cardinal = label.kind === 'cardinal';
            this.projection.copy(label.position);
            if (!cardinal)
                this.projection.applyMatrix4(this.sphere.matrix);
            const enabled = cardinal ? this.state.ground : this.state.labels && (label.kind !== 'planet' || this.state.planets);
            const visible = enabled && (!this.state.ground || this.projection.y >= 0) && this.projection.dot(this.forward) > 0;
            if (visible) {
                this.projection.project(this.camera);
                const onscreen = Math.abs(this.projection.x) < .98 && Math.abs(this.projection.y) < .95;
                label.node.hidden = !onscreen;
                if (onscreen)
                    label.node.style.transform = 'translate(' + ((this.projection.x * .5 + .5) * this.view.width) + 'px,' + ((-this.projection.y * .5 + .5) * this.view.height) + 'px) translate(-50%,-50%)';
            }
            else
                label.node.hidden = true;
        }
        this.view.renderer.render(this.scene, this.camera);
        return this.state.playing || Math.abs(this.vx) + Math.abs(this.vy) > .002 || Math.abs(this.yaw - this.targetYaw) + Math.abs(this.pitch - this.targetPitch) + Math.abs(this.fov - this.camera.fov) > .002;
    }
    private down = (e: PointerEvent): void => {
        if (e.button !== 0)
            return;
        this.view.renderer.domElement.setPointerCapture(e.pointerId);
        this.view.renderer.domElement.focus();
        this.pointers.set(e.pointerId, new THREE.Vector2(e.clientX, e.clientY));
        this.start.set(e.clientX, e.clientY);
        this.travelled = 0;
        this.vx = this.vy = 0;
        this.pinch = 0;
        this.view.wake();
    };
    private move = (e: PointerEvent): void => {
        const previous = this.pointers.get(e.pointerId);
        if (!previous)
            return;
        const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
        this.travelled += Math.hypot(dx, dy);
        previous.set(e.clientX, e.clientY);
        if (this.pointers.size === 2) {
            const [a, b] = [...this.pointers.values()];
            const distance = a!.distanceTo(b!);
            if (this.pinch)
                this.fov = THREE.MathUtils.clamp(this.fov * this.pinch / Math.max(1, distance), 30, 90);
            this.pinch = distance;
            this.travelled = 100;
        }
        else {
            const sensitivity = this.fov * RAD / this.view.height;
            this.targetYaw -= dx * sensitivity;
            this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * sensitivity, -1.53, 1.53);
            this.vx = -dx * sensitivity * 30;
            this.vy = dy * sensitivity * 30;
        }
        this.view.wake();
    };
    private up = (e: PointerEvent): void => {
        if (this.pointers.has(e.pointerId) && this.travelled < 6 && this.pointers.size === 1)
            this.pick(e);
        this.cancel(e);
    };
    private cancel = (e: PointerEvent): void => { this.pointers.delete(e.pointerId); this.pinch = 0; this.view.wake(); };
    private wheel = (e: WheelEvent): void => { e.preventDefault(); this.fov = THREE.MathUtils.clamp(this.fov + e.deltaY * .035, 30, 90); this.view.wake(); };
    private key = (e: KeyboardEvent): void => {
        const step = .12;
        if (e.key === 'ArrowLeft')
            this.targetYaw -= step;
        else if (e.key === 'ArrowRight')
            this.targetYaw += step;
        else if (e.key === 'ArrowUp')
            this.targetPitch = Math.min(1.53, this.targetPitch + step);
        else if (e.key === 'ArrowDown')
            this.targetPitch = Math.max(-1.53, this.targetPitch - step);
        else if (e.key === '+' || e.key === '=')
            this.fov = Math.max(30, this.fov - 5);
        else if (e.key === '-')
            this.fov = Math.min(90, this.fov + 5);
        else
            return;
        e.preventDefault();
        this.view.wake();
    };
    private pick(e: PointerEvent): void {
        const rect = this.view.renderer.domElement.getBoundingClientRect();
        this.picked.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1, .5).unproject(this.camera).normalize();
        let closest: SkyObject | undefined;
        let best = Math.cos(Math.max(1.2, this.fov * 18 / this.view.height) * RAD);
        const candidates = this.state.planets ? [...stars, ...this.objects] : stars;
        for (const object of candidates) {
            this.projection.copy(equatorial(object.ra, object.dec, 1)).applyMatrix4(this.sphere.matrix);
            if (this.state.ground && this.projection.y < 0)
                continue;
            const dot = this.projection.dot(this.picked);
            if (dot > best) {
                best = dot;
                closest = object;
            }
        }
        if (closest)
            this.select(closest);
    }
    dispose(): void {
        const c = this.view?.renderer.domElement;
        c?.removeEventListener('pointerdown', this.down);
        c?.removeEventListener('pointermove', this.move);
        c?.removeEventListener('pointerup', this.up);
        c?.removeEventListener('pointercancel', this.cancel);
        c?.removeEventListener('lostpointercapture', this.cancel);
        c?.removeEventListener('wheel', this.wheel);
        c?.removeEventListener('keydown', this.key);
        this.pointers.clear();
        this.labelLayer?.remove();
        disposeTree(this.scene);
        this.view?.dispose();
    }
}
