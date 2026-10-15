import * as THREE from 'three';
import { stars, constellations, type SkyObject } from './catalog';
import { cities, equatorial, observerMatrix, planets, solarDirection, RAD } from './astronomy';
import { atmosphere, horizon, lunarSphere, figures } from './scenery';
import { WindowRenderer, disposeTree } from './runtime';
export interface SkyState {
    time: number;
    city: number;
    lines: boolean;
    labels: boolean;
    ground: boolean;
    planets: boolean;
    playing: boolean;
    speed: number;
    figures: boolean;
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
    private line: THREE.Mesh;
    private figureLines: THREE.LineSegments;
    private atmosphere = atmosphere();
    private moon = lunarSphere();
    private milkyMaterial: THREE.ShaderMaterial;
    private skyMap!: THREE.Texture;
    private pulse: ReturnType<typeof setInterval> | undefined;
    private meteorAge = 2;
    private nextMeteor = 0;
    private meteor = new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3)),new THREE.LineBasicMaterial({ color: '#e0eeff',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending }));
    private ground: THREE.Mesh;
    private starMaterial: THREE.ShaderMaterial;
    private planetary = new THREE.Group();
    private objects: SkyObject[] = [];
    private yaw = -1.1;
    private pitch = .23;
    private targetYaw = -1.1;
    private targetPitch = .23;
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
            if (compact) this.pitch = this.targetPitch = .12;
            this.scene.add(this.atmosphere, this.sphere, this.meteor);
            this.meteor.visible = false;
            const positions: number[] = [], colours: number[] = [], magnitudes: number[] = [], phases: number[] = [];
            let seed = 417;
            const random = (): number => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
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
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
            geometry.setAttribute('magnitude', new THREE.Float32BufferAttribute(magnitudes, 1));
            geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
            this.starMaterial = new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
                uniforms: { time: { value: 0 }, ratio: { value: 1 }, zoom: { value: 1 }, twinkle: { value: 1 }, night: { value: 1 } },
                vertexShader: `attribute vec3 color;attribute float magnitude;attribute float phase;uniform float time;uniform float ratio;uniform float zoom;uniform float twinkle;uniform float night;varying vec3 tint;varying float light;varying float bright;void main(){tint=color;vec4 world=modelMatrix*vec4(position,1.);float horizon=exp(-abs(normalize(world.xyz).y)*12.);float scintillation=1.+twinkle*(.035+.16*horizon)*sin(time*(1.4+horizon*2.)+phase);light=(.2+pow(2.512,-magnitude*.4)*1.6)*scintillation*night;bright=1.-smoothstep(.0,2.5,magnitude);gl_Position=projectionMatrix*viewMatrix*world;gl_PointSize=clamp((2.+pow(max(0.,7.-magnitude),1.2)*1.55)*ratio*zoom,1.4,32.);}`,
                fragmentShader: `varying vec3 tint;varying float light;varying float bright;void main(){vec2 q=(gl_PointCoord-.5)*2.;float d=length(q);if(d>1.)discard;float core=exp(-d*d*35.);float halo=exp(-d*d*6.)*.25;float rays=(exp(-abs(q.x)*75.)+exp(-abs(q.y)*75.))*exp(-d*4.)*bright*.15;gl_FragColor=vec4(mix(tint,vec3(1.),core*.6),(core+halo+rays)*light);}`,
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
            // Screen-space ribbon quads produce soft line glow in one draw call, without a bloom pass.
            const ribbon: number[] = [], endpoint: number[] = [], edge: number[] = [], ribbonSide: number[] = [];
            for (let i=0;i<segments.length;i+=6) {
                const a=segments.slice(i,i+3), b=segments.slice(i+3,i+6);
                for (const [at,side] of [[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]]) {
                    ribbon.push(...(at ? b : a)); endpoint.push(...(at ? a : b)); edge.push((at ? -1 : 1)*side!); ribbonSide.push(side!);
                }
            }
            const lineGeometry = new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(ribbon,3)).setAttribute('endpoint',new THREE.Float32BufferAttribute(endpoint,3)).setAttribute('edge',new THREE.Float32BufferAttribute(edge,1)).setAttribute('ribbonSide',new THREE.Float32BufferAttribute(ribbonSide,1));
            this.line = new THREE.Mesh(lineGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{viewport:{value:new THREE.Vector2(1120,700)}},vertexShader:`attribute vec3 endpoint;attribute float edge;attribute float ribbonSide;uniform vec2 viewport;varying float e;void main(){vec4 a=projectionMatrix*modelViewMatrix*vec4(position,1.);vec4 b=projectionMatrix*modelViewMatrix*vec4(endpoint,1.);vec2 delta=(b.xy/b.w-a.xy/a.w)*viewport;vec2 normal=normalize(vec2(-delta.y,delta.x));a.xy+=normal*edge*3./viewport*a.w;e=ribbonSide;gl_Position=a;}`,fragmentShader:`varying float e;void main(){float light=exp(-e*e*12.)*.3+exp(-e*e*2.)*.07;gl_FragColor=vec4(.46,.65,.96,light);}` }));
            this.line.frustumCulled=false;
            this.sphere.add(this.line);
            const drawing: number[]=[];
            for (const figure of figures) for(const path of figure.paths) for(let i=1;i<path.length;i++) {
                const a=path[i-1]!, b=path[i]!;
                for(let j=0;j<3;j++) for(const t of [j/3,(j+1)/3]) {
                    const p=equatorial(figure.ra+(a[0]!+(b[0]!-a[0]!)*t)*figure.scale[0],figure.dec+(a[1]!+(b[1]!-a[1]!)*t)*figure.scale[1],99.3);
                    drawing.push(p.x,p.y,p.z);
                }
            }
            this.figureLines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(drawing,3)),new THREE.LineBasicMaterial({color:'#c3b7e9',transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending}));
            this.sphere.add(this.figureLines);
            // The faint sky is real: NASA's Deep Star Maps 2020 (Hipparcos, Tycho-2 and Gaia), an equirectangular
            // map in equatorial coordinates with 0h at the centre and right ascension increasing to the left.
            this.skyMap = new THREE.TextureLoader().load(`/vision/sky/stars-${compact ? '4k' : '6k'}.webp`, () => this.view?.wake());
            this.skyMap.colorSpace = THREE.SRGBColorSpace; this.skyMap.generateMipmaps = false; this.skyMap.minFilter = THREE.LinearFilter; this.skyMap.wrapS = THREE.RepeatWrapping;
            this.milkyMaterial = new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{map:{value:this.skyMap},night:{value:1},gain:{value:2.3}},
                vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
                fragmentShader:`varying vec3 direction;uniform sampler2D map;uniform float night;uniform float gain;void main(){vec3 p=normalize(direction);vec2 uv=vec2(fract(.5-atan(p.z,p.x)/6.2831853),.5+asin(clamp(p.y,-1.,1.))/3.1415927);gl_FragColor=vec4(texture2D(map,uv).rgb*gain,night);}`});
            this.sphere.add(new THREE.Mesh(new THREE.SphereGeometry(110,48,32),this.milkyMaterial));
            this.ground=horizon(); this.scene.add(this.ground);
            this.planetary.add(this.moon);
            this.planetMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ratio: { value: 1 } },
                vertexShader: 'attribute vec3 color;attribute float size;uniform float ratio;varying vec3 tint;void main(){tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*ratio;}',
                fragmentShader: 'varying vec3 tint;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float disc=1.-smoothstep(.2,.3,d);gl_FragColor=vec4(mix(tint,vec3(1.),disc*.35),disc*.7+exp(-d*d*6.)*.3);}' });
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
            this.view = new WindowRenderer(host, compact, (dt, t) => this.draw(dt, t), () => { this.camera.aspect = this.view.width / this.view.height; this.camera.updateProjectionMatrix(); if (this.view.height < 560 && this.yaw === -1.1) this.pitch = this.targetPitch = .12; });
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
            this.nextMeteor=performance.now()/1000+18;
            // Quiet skies use a handful of dirty frames for twinkle, never a continuous idle rAF loop.
            this.pulse=setInterval(() => { if(this.view.active && !this.view.motion.matches) this.view.wake(); },220);
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
        this.objects.forEach((object, i) => { if (object.name === 'Moon') { this.moon.position.copy(equatorial(object.ra,object.dec,98)); return; } const pos = equatorial(object.ra, object.dec, 98); p.push(pos.x, pos.y, pos.z); const color = new THREE.Color(colors[i]); c.push(color.r, color.g, color.b); sizes.push(i === 2 ? 20 : i === 4 ? 17 : 13); });
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
        const sun=solarDirection(this.state.time);
        this.moon.material.uniforms.sun!.value.copy(sun);
        sun.applyMatrix4(observerMatrix(this.state.time,city.lat,city.lon));
        this.atmosphere.material.uniforms.sun!.value.copy(sun);
        const night=1-THREE.MathUtils.smoothstep(sun.y,-.24,.01);
        this.starMaterial.uniforms.night!.value=night;
        this.milkyMaterial.uniforms.night!.value=night;
        (this.ground.material as THREE.ShaderMaterial).uniforms.day!.value=THREE.MathUtils.smoothstep(sun.y,-.15,.15);
        this.figureLines.visible=this.state.figures;
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
            this.state.time += dt * 1000 * this.state.speed;
            this.advance(dt * 3600000);
            if (Math.abs(this.state.time - this.lastSkyTime) > 60000)
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
        (this.line.material as THREE.ShaderMaterial).uniforms.viewport!.value.set(this.view.width,this.view.height);
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
        if (!reduced && time > this.nextMeteor && this.starMaterial.uniforms.night!.value > .6) {
            this.nextMeteor=time+28+Math.random()*30; this.meteorAge=0;
            const yaw=this.yaw-.3, pitch=this.pitch+.16;
            const origin=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(80);
            const attr=this.meteor.geometry.getAttribute('position');
            attr.setXYZ(0,origin.x,origin.y,origin.z);attr.setXYZ(1,origin.x,origin.y,origin.z);attr.needsUpdate=true;
            this.meteor.visible=true;
        }
        if (this.meteorAge<1.05 && !reduced) {
            this.meteorAge+=dt;const attr=this.meteor.geometry.getAttribute('position');
            const origin=new THREE.Vector3().fromBufferAttribute(attr,0);
            // A short trail crossing the observer's sky. Artistic, not an event prediction.
            origin.x+=dt*13;origin.y-=dt*10;
            attr.setXYZ(0,origin.x,origin.y,origin.z);attr.setXYZ(1,origin.x-3.5,origin.y+2.7,origin.z);attr.needsUpdate=true;
            this.meteor.geometry.computeBoundingSphere();this.meteor.material.opacity=Math.sin(Math.PI*Math.min(1,this.meteorAge/1.05))*.65;
        } else this.meteor.visible=false;
        this.view.renderer.render(this.scene, this.camera);
        return this.state.playing || (!reduced && this.meteorAge < 1.05) || Math.abs(this.vx) + Math.abs(this.vy) > .002 || Math.abs(this.yaw - this.targetYaw) + Math.abs(this.pitch - this.targetPitch) + Math.abs(this.fov - this.camera.fov) > .002;
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
        clearInterval(this.pulse);
        this.skyMap?.dispose();
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
