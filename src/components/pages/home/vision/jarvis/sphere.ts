import {
  AdditiveBlending, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, Float32BufferAttribute, Group, LineSegments, Mesh,
  PerspectiveCamera, Points, Quaternion, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * The JARVIS consciousness sphere from Age of Ultron. Animal Logic described the film's version as orange
 * arcs like an orrery, rings built from blocks of data, the whole thing vibrating with the audio like a
 * volumetric equaliser. This one is built the same way:
 *
 *  - five shells of gold circuit traces, with pulses of light running along them like data in transit;
 *  - code panels lying on the outer shells;
 *  - an orrery of three rings made of data blocks that rise and fall with the voice's spectrum;
 *  - sweeping ribbons, tick rings and long spokes;
 *  - a filament "mind" curling inside, and a ring core with an anamorphic streak;
 *  - sparks and glints, softer the further they are from focus.
 *
 * Everything shares one shader, so it can assemble out of the corner orb, think, speak and fold back in
 * together. A last pass turns light into alpha with a touch of fringing, scanlines and flicker, so it reads
 * as a projection in the room rather than a picture on top of it.
 */
export type SphereMode = 'idle' | 'listening' | 'thinking' | 'speaking';

const AMBER = new Color(1.0, 0.42, 0.04), GOLD = new Color(1.0, 0.7, 0.22), WHITE = new Color(1.0, 0.9, 0.66);
const BANDS = 48;

const Projection = {
  uniforms: { tDiffuse: { value: null }, uAspect: { value: 1 }, uTime: { value: 0 }, uHeight: { value: 800 }, uFlicker: { value: 1 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform float uAspect, uTime, uHeight, uFlicker; varying vec2 vUv;
    void main(){
      // A hair of chromatic fringing toward the edges, as if through a projector's lens.
      vec2 off = (vUv - .5) * .0045;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c = max(c - .026, 0.) * 1.04;
      // Soft shoulder: bright overlaps keep their colour instead of burning out to white.
      c = c * (1. + c * .18) / (1. + c * .62) * 1.22;
      float scan = .955 + .045 * sin(vUv.y * uHeight * 1.35 + uTime * 9.);
      float flick = 1. - .05 * step(.985, fract(sin(floor(uTime * 24.)) * 43758.5)) * uFlicker;
      c *= scan * flick;
      vec2 d = (vUv - .5) * vec2(uAspect, 1.);
      c *= smoothstep(.5, .36, length(d) / max(1., uAspect));
      float a = clamp(max(max(c.r, c.g), c.b) * 1.1, 0., 1.);
      gl_FragColor = vec4(c, a);
    }`,
};

const COMMON = /* glsl */`
  uniform float uTime, uAssemble, uImplode, uLevel, uThink, uListen, uPixel, uGain, uFromOrigin, uFlow;
  uniform vec3 uGaze, uOrigin;
  attribute vec3 aScatter;
  attribute float aSeed, aFade, aTrail;
  varying float vAlpha, vHeat;
  vec3 place(vec3 p) {
    // Where this fragment comes from: scattered all round, or streaming out of the corner orb.
    vec3 origin = uOrigin; // already in the sphere's own space, updated each frame
    vec3 start = mix(p + aScatter, origin + aScatter * .06, uFromOrigin);
    float t = smoothstep(aSeed * .55, aSeed * .55 + .45, uAssemble);
    vec3 q = mix(start, p, t);
    float r = length(p);
    // Speaking sends rings of light out from the core; thinking makes every fragment shiver.
    float wave = .5 + .5 * sin(r * 16. - uTime * 7.);
    q *= 1. + uLevel * .055 * wave + uThink * .012 * sin(uTime * 11. + aSeed * 60.) - uListen * .03;
    q = mix(q, mix(q * .03, origin, uFromOrigin), uImplode);
    float flicker = .62 + .38 * sin(uTime * (1.3 + aSeed * 5.) + aSeed * 97.);
    flicker = mix(flicker, step(.5, fract(sin(floor(uTime * 14. + aSeed * 30.)) * 4375.85)), uThink * .55);
    float facing = .2 + .8 * smoothstep(-1.1, 1.0, (modelMatrix * vec4(q, 1.)).z);
    vec3 nWorld = normalize(mat3(modelMatrix) * normalize(p + vec3(1e-5)));
    float rim = pow(1. - abs(nWorld.z), 3.) * step(.55, length(p));
    float gaze = smoothstep(.82, .98, dot(normalize(p), uGaze)) * step(.001, length(uGaze));
    // Data in transit: a bright pulse runs along each trace, faster while thinking.
    float pulse = 0.;
    if (aTrail >= 0.) {
      float head = fract(uTime * (.18 + aSeed * .35) * uFlow + aSeed * 7.);
      pulse = smoothstep(.16, 0., abs(head - aTrail)) * step(aTrail, head);
    }
    float ripple = pow(wave, 9.);
    vAlpha = t * flicker * facing * aFade * (1. - uImplode * .6) * (.85 + rim * .55 + uLevel * (ripple * 1.1 - .12) + gaze * 1.6 + uListen * .3 + pulse * 2.4) * uGain;
    vHeat = clamp(gaze + uLevel * ripple * .45 + (1. - r) * .22 + rim * .25 + uImplode + pulse * .9, 0., 1.);
    return q;
  }
`;
const lineMaterial = (uniforms: Record<string, { value: unknown }>, gain = .34) => new ShaderMaterial({
  uniforms, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
  vertexShader: COMMON + /* glsl */`void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(place(position), 1.); }`,
  fragmentShader: /* glsl */`uniform vec3 uColor, uHot; varying float vAlpha, vHeat;
    void main(){ gl_FragColor = vec4(mix(uColor, uHot, vHeat) * vAlpha * ${gain.toFixed(3)}, 1.); }`,
});

/** A sphere point from latitude and longitude. */
const onSphere = (lat: number, lon: number, r: number) => new Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const scatter = () => new Vector3().randomDirection().multiplyScalar(rand(1.4, 4.2));

class Builder {
  positions: number[] = []; scatters: number[] = []; seeds: number[] = []; fades: number[] = []; uvs: number[] = []; trails: number[] = [];
  push(p: Vector3, s: Vector3, seed: number, fade = 1, u = 0, v = 0, trail = -1) {
    this.positions.push(p.x, p.y, p.z); this.scatters.push(s.x, s.y, s.z); this.seeds.push(seed); this.fades.push(fade); this.uvs.push(u, v); this.trails.push(trail);
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('aScatter', new Float32BufferAttribute(this.scatters, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(this.seeds, 1));
    g.setAttribute('aFade', new Float32BufferAttribute(this.fades, 1));
    g.setAttribute('aTrail', new Float32BufferAttribute(this.trails, 1));
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    return g;
  }
  clear() { this.positions = []; this.scatters = []; this.seeds = []; this.fades = []; this.uvs = []; this.trails = []; }
}

/** Code fragments for the little panels: hex, bars, brackets and tiny schematics, drawn once into an atlas. */
function glyphAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1024, 1024);
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase();
  const words = ['init', 'sync', 'core', 'mesh', 'vec3', 'proc', 'heap', 'node', 'link', 'scan', 'trace', 'gaze', 'lens', 'orb', 'tick', 'feed'];
  for (let i = 0; i < 64; i++) {
    const x = (i % 8) * 128, y = Math.floor(i / 8) * 128;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 4, 120, 120); ctx.clip();
    ctx.strokeStyle = ctx.fillStyle = '#fff';
    const kind = i % 4;
    if (kind === 0) {
      ctx.font = '600 15px monospace';
      for (let row = 0; row < 6; row++) { ctx.globalAlpha = .45 + Math.random() * .55; ctx.fillText(`${hex()} ${hex()}`, x + 8, y + 22 + row * 18); }
    } else if (kind === 1) {
      ctx.font = '600 16px monospace';
      for (let row = 0; row < 5; row++) { ctx.globalAlpha = .5 + Math.random() * .5; ctx.fillText(`${'  '.repeat(row % 3)}${words[(i + row) % words.length]}()`, x + 8, y + 24 + row * 21); }
    } else if (kind === 2) {
      ctx.lineWidth = 3; ctx.globalAlpha = .9; ctx.strokeRect(x + 10, y + 10, 108, 108);
      for (let b = 0; b < 9; b++) { const h = 8 + Math.random() * 80; ctx.globalAlpha = .4 + Math.random() * .6; ctx.fillRect(x + 16 + b * 11, y + 112 - h, 7, h); }
    } else {
      ctx.lineWidth = 2.5; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.arc(x + 64, y + 64, 42, Math.random() * 3, Math.random() * 3 + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 10, y + 64); ctx.lineTo(x + 118, y + 64); ctx.moveTo(x + 64, y + 10); ctx.lineTo(x + 64, y + 118); ctx.globalAlpha = .4; ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillRect(x + 60, y + 60, 8, 8);
    }
    ctx.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export class JarvisSphere {
  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private projection!: ShaderPass;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, .1, 50);
  private root = new Group();
  private shells: { group: Group; spin: Vector3 }[] = [];
  private uniforms = {
    uTime: { value: 0 }, uAssemble: { value: 0 }, uImplode: { value: 0 }, uLevel: { value: 0 }, uThink: { value: 0 }, uListen: { value: 0 },
    uPixel: { value: 1 }, uGain: { value: 1 }, uGaze: { value: new Vector3() }, uColor: { value: AMBER.clone() }, uHot: { value: GOLD.clone() },
    uOrigin: { value: new Vector3() }, uFromOrigin: { value: 0 }, uFlow: { value: 1 }, uBands: { value: new Float32Array(BANDS) },
  };
  private disposables: { dispose(): void }[] = [];
  private frame = 0;
  private last = 0;
  private mode: SphereMode = 'idle';
  private target = { assemble: 0, implode: 0 };
  private spin = new Vector2(0, 0);
  private drag: { x: number; y: number } | null = null;
  private pointer: Vector2 | null = null;
  private running = false;
  private observer: ResizeObserver;
  private core = new Group();
  private streak!: Mesh;
  private flare = 0;
  private originWorld = new Vector3();
  /** The voice level, sampled each frame. Set by whoever owns the audio. */
  level: () => number = () => 0;
  /** The voice spectrum, 0..1 per band, for the equaliser rings. */
  spectrum: () => Float32Array | null = () => null;

  constructor(private canvas: HTMLCanvasElement, options: { quality?: 'high' | 'low' } = {}) {
    const low = options.quality === 'low';
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75));
    this.uniforms.uPixel.value = this.renderer.getPixelRatio();
    this.camera.position.set(0, 0, 4.6);
    this.scene.add(this.root);
    this.root.rotation.set(.32, -.4, .08);
    this.build(low);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 1.05, .38, .08);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.projection = new ShaderPass(Projection);
    this.composer.addPass(this.projection);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', this.leave);
    window.addEventListener('pointerup', this.up);
  }

  private shell(spin: [number, number, number], parent: Group = this.root) {
    const group = new Group();
    parent.add(group);
    this.shells.push({ group, spin: new Vector3(...spin) });
    return group;
  }

  private build(low: boolean) {
    const material = lineMaterial(this.uniforms);
    this.disposables.push(material);
    const density = low ? .55 : 1;

    // Circuit traces on five shells, gathered in knots the way the film's sphere is.
    const layers = [.58, .7, .82, .94, 1.04];
    const clusters = Array.from({ length: 34 }, () => [rand(-1.25, 1.25), rand(0, Math.PI * 2)] as const);
    layers.forEach((radius, layer) => {
      const traces = new Builder();
      const count = Math.round([300, 360, 440, 520, 380][layer]! * density);
      for (let f = 0; f < count; f++) {
        const seed = Math.random();
        const s = scatter();
        let lat: number, lon: number;
        if (Math.random() < .68) { const [cl, co] = clusters[Math.floor(Math.random() * clusters.length)]!; lat = cl + rand(-.28, .28); lon = co + rand(-.4, .4); }
        else { lat = Math.asin(rand(-.96, .96)); lon = rand(0, Math.PI * 2); }
        const fade = Math.random() < .26 ? rand(1.4, 2.4) : rand(.15, .55);
        const r = radius + rand(-.015, .015);
        // Only some traces carry data, so the pulses read as signals rather than noise.
        const carries = Math.random() < .35;
        if (Math.random() < .06) {
          const span = rand(.4, 1.6), steps = Math.ceil(span / .03);
          for (let k = 0; k < steps; k++) {
            const tr = carries ? k / steps : -1;
            traces.push(onSphere(lat, lon + k * .03, r), s, seed, fade * .8, 0, 0, tr); traces.push(onSphere(lat, lon + (k + 1) * .03, r), s, seed, fade * .8, 0, 0, tr);
          }
          continue;
        }
        // Collect the path first so each vertex knows how far along the trace it sits.
        const path: Vector3[] = [onSphere(lat, lon, r)];
        let along = Math.random() < .5;
        for (let step = 0, steps = 2 + Math.floor(Math.random() * 5); step < steps; step++) {
          const length = along ? rand(.03, .16) * Math.sign(rand(-1, 1)) : rand(.02, .09) * Math.sign(rand(-1, 1));
          const parts = Math.max(1, Math.ceil(Math.abs(length) / .025));
          for (let k = 1; k <= parts; k++) path.push(along ? onSphere(lat, lon + length * k / parts, r) : onSphere(lat + length * k / parts, lon, r));
          if (along) lon += length; else lat = Math.max(-1.4, Math.min(1.4, lat + length));
          along = !along;
        }
        for (let k = 0; k < path.length - 1; k++) {
          traces.push(path[k]!, s, seed, fade, 0, 0, carries ? k / (path.length - 1) : -1);
          traces.push(path[k + 1]!, s, seed, fade, 0, 0, carries ? (k + 1) / (path.length - 1) : -1);
        }
      }
      const spin: [number, number, number] = [[.0, .05, .0], [.01, -.07, .0], [.0, .09, .015], [-.012, -.04, .0], [.0, .03, -.01]][layer] as [number, number, number];
      const lines = new LineSegments(traces.geometry(), material);
      this.disposables.push(lines.geometry);
      this.shell(spin).add(lines);
    });

    // Code panels lying on the outer shells.
    const atlas = glyphAtlas();
    this.disposables.push(atlas);
    const panelMaterial = new ShaderMaterial({
      uniforms: { ...this.uniforms, uAtlas: { value: atlas } }, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      vertexShader: COMMON + /* glsl */`attribute vec2 aCell; varying vec2 vUv; void main(){ vUv = (aCell + uv) / 8.; gl_Position = projectionMatrix * modelViewMatrix * vec4(place(position), 1.); }`,
      fragmentShader: /* glsl */`uniform vec3 uColor, uHot; uniform sampler2D uAtlas; varying float vAlpha, vHeat; varying vec2 vUv;
        void main(){ float ink = texture2D(uAtlas, vUv).r; gl_FragColor = vec4(mix(uColor, uHot, vHeat) * ink * vAlpha * .5, 1.); }`,
    });
    this.disposables.push(panelMaterial);
    const panels = new Builder();
    const cells: number[] = [], index: number[] = [];
    for (let i = 0, n = Math.round(300 * density); i < n; i++) {
      const [cl, co] = clusters[i % clusters.length]!;
      const lat = Math.random() < .7 ? cl + rand(-.3, .3) : Math.asin(rand(-.9, .9));
      const lon = Math.random() < .7 ? co + rand(-.45, .45) : rand(0, Math.PI * 2);
      const r = [.82, .94, 1.04, 1.1][Math.floor(Math.random() * 4)]!;
      const centre = onSphere(lat, lon, r), normal = centre.clone().normalize();
      const east = new Vector3(-Math.sin(lon), 0, Math.cos(lon)), north = normal.clone().cross(east).negate();
      const w = rand(.025, .085), h = w * rand(.5, 1.1);
      const s = scatter(), seed = Math.random(), fade = Math.random() < .3 ? rand(1.4, 2.2) : rand(.3, .7);
      const cell = Math.floor(Math.random() * 64);
      const base = panels.positions.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
        panels.push(centre.clone().addScaledVector(east, (u - .5) * w).addScaledVector(north, (v - .5) * h), s, seed, fade, u, 1 - v);
        cells.push(cell % 8, Math.floor(cell / 8));
      }
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const panelGeometry = panels.geometry();
    panelGeometry.setAttribute('aCell', new Float32BufferAttribute(cells, 2));
    panelGeometry.setIndex(index);
    this.disposables.push(panelGeometry);
    this.shell([0, .06, 0]).add(new Mesh(panelGeometry, panelMaterial));

    // The orrery: three tilted rings of data blocks that rise and fall with the voice, like an equaliser.
    const blockMaterial = new ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      vertexShader: COMMON + /* glsl */`uniform float uBands[${BANDS}]; attribute vec3 aOut; attribute float aBand, aTop;
        void main(){
          int band = int(aBand);
          float lift = uBands[band] * .15 + .01 + .006 * sin(uTime * 2. + aBand * .7);
          vec3 base = place(position);
          vHeat = max(vHeat, aTop * .7 + uBands[band] * .6);
          vAlpha *= .55 + uBands[band] * .9;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(base + aOut * lift * aTop * uAssemble, 1.);
        }`,
      fragmentShader: /* glsl */`uniform vec3 uColor, uHot; varying float vAlpha, vHeat;
        void main(){ gl_FragColor = vec4(mix(uColor, uHot, vHeat) * vAlpha * .3, 1.); }`,
    });
    this.disposables.push(blockMaterial);
    const orrery = this.shell([0, .03, 0]);
    [[1.2, new Vector3(.12, 1, .2), 96, 0], [1.34, new Vector3(-.5, 1, .15), 72, 12], [1.46, new Vector3(.25, 1, -.55), 120, 24]].forEach(([radius, tilt, count, offset]) => {
      const blocks = new Builder();
      const outs: number[] = [], bands: number[] = [], tops: number[] = [], index: number[] = [];
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), (tilt as Vector3).clone().normalize());
      const s = scatter(), seed = Math.random();
      for (let k = 0; k < (count as number); k++) {
        if (k % 8 === 7) continue; // gaps between groups of blocks
        const a = k / (count as number) * Math.PI * 2, w = Math.PI * 2 / (count as number) * .34;
        const out = new Vector3(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q);
        const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).applyQuaternion(q);
        const centre = out.clone().multiplyScalar(radius as number);
        const band = ((k + (offset as number)) % BANDS + BANDS) % BANDS;
        const base = blocks.positions.length / 3;
        for (const [u, top] of [[-1, 0], [1, 0], [1, 1], [-1, 1]] as const) {
          blocks.push(centre.clone().addScaledVector(side, u * w * (radius as number) / 2), s, seed, .9);
          outs.push(out.x, out.y, out.z); bands.push(band); tops.push(top);
        }
        index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const geometry = blocks.geometry();
      geometry.setAttribute('aOut', new Float32BufferAttribute(outs, 3));
      geometry.setAttribute('aBand', new Float32BufferAttribute(bands, 1));
      geometry.setAttribute('aTop', new Float32BufferAttribute(tops, 1));
      geometry.setIndex(index);
      this.disposables.push(geometry);
      const mesh = new Mesh(geometry, blockMaterial);
      mesh.frustumCulled = false;
      this.shell([0, (offset as number) % 24 ? -.06 : .05, 0], orrery).add(mesh);
    });

    // Sweeping ribbons: bright heads with long fading tails, each on its own tilted great circle.
    const ribbons = new Builder();
    for (let i = 0; i < 9; i++) {
      const radius = [.46, .52, .62, .75, .9, 1.0, 1.08, 1.16, .38][i]!;
      const axis = new Vector3().randomDirection(), start = rand(0, Math.PI * 2), span = rand(1.6, 4.4);
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis);
      const s = scatter(), seed = Math.random();
      const strands = i < 3 ? 12 : 6;
      for (let strand = 0; strand < strands; strand++) {
        const offset = (strand - strands / 2) * (i < 3 ? .007 : .004), wobble = rand(-.02, .02);
        for (let k = 0, steps = 120; k < steps; k++) {
          const a = start + span * k / steps, b = start + span * (k + 1) / steps;
          const fade = Math.pow(k / steps, 1.6) * (strand % 3 === 0 ? 1 : .5) * (i < 3 ? 2.6 : 1.8);
          const p1 = new Vector3(Math.cos(a) * (radius + offset), wobble * Math.sin(a * 3), Math.sin(a) * (radius + offset)).applyQuaternion(q);
          const p2 = new Vector3(Math.cos(b) * (radius + offset), wobble * Math.sin(b * 3), Math.sin(b) * (radius + offset)).applyQuaternion(q);
          ribbons.push(p1, s, seed, fade, 0, 0, strand % 3 === 0 ? k / steps : -1); ribbons.push(p2, s, seed, fade, 0, 0, strand % 3 === 0 ? (k + 1) / steps : -1);
        }
      }
      const group = this.shell([rand(-.25, .25), rand(.15, .5) * (i % 2 ? 1 : -1), rand(-.2, .2)]);
      const lines = new LineSegments(ribbons.geometry(), material);
      this.disposables.push(lines.geometry);
      group.add(lines);
      ribbons.clear();
    }

    // Tick rings and dashed orbits, like the measuring rings on Stark's displays.
    const rings = new Builder();
    const ring = (radius: number, tilt: Vector3, ticks: number, tickLength: number, dash: number, fade: number) => {
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), tilt.normalize());
      const s = scatter(), seed = Math.random();
      for (let k = 0; k < ticks; k++) {
        const a = k / ticks * Math.PI * 2, major = k % 10 === 0;
        const inner = new Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius).applyQuaternion(q);
        const outer = new Vector3(Math.cos(a) * (radius + tickLength * (major ? 2.2 : 1)), 0, Math.sin(a) * (radius + tickLength * (major ? 2.2 : 1))).applyQuaternion(q);
        rings.push(inner, s, seed, fade); rings.push(outer, s, seed, fade);
        if (dash && k % dash < dash / 2) {
          const b = (k + 1) / ticks * Math.PI * 2;
          rings.push(inner, s, seed, fade * .7); rings.push(new Vector3(Math.cos(b) * radius, 0, Math.sin(b) * radius).applyQuaternion(q), s, seed, fade * .7);
        }
      }
    };
    ring(1.27, new Vector3(.3, 1, -.2), 120, .015, 8, .45);
    ring(.3, new Vector3(0, 0, 1), 90, .02, 6, 1);
    ring(.22, new Vector3(.2, .1, 1), 60, .012, 4, .9);
    const ringLines = new LineSegments(rings.geometry(), material);
    this.disposables.push(ringLines.geometry);
    this.shell([0, .02, .04]).add(ringLines);

    // Long straight spokes from the core out past the shell, carrying signals outward.
    const spokes = new Builder();
    for (let i = 0; i < 26; i++) {
      const dir = new Vector3().randomDirection(), s = scatter(), seed = Math.random();
      const from = rand(.12, .3), to = rand(1.05, 1.5);
      for (let k = 0; k < 12; k++) {
        const a = from + (to - from) * k / 12, b = from + (to - from) * (k + 1) / 12;
        const fade = Math.sin(Math.PI * k / 12) * .7;
        spokes.push(dir.clone().multiplyScalar(a), s, seed, fade, 0, 0, k / 12); spokes.push(dir.clone().multiplyScalar(b), s, seed, fade, 0, 0, (k + 1) / 12);
      }
    }
    const spokeLines = new LineSegments(spokes.geometry(), material);
    this.disposables.push(spokeLines.geometry);
    this.shell([.01, -.02, 0]).add(spokeLines);

    // The mind: soft filaments curling through the inside of the sphere.
    const filaments = new Builder();
    for (let i = 0, n = Math.round(46 * density); i < n; i++) {
      const points = Array.from({ length: 5 }, () => new Vector3().randomDirection().multiplyScalar(Math.pow(Math.random(), .6) * .44));
      const curve = new CatmullRomCurve3(points), samples = curve.getPoints(70);
      const s = scatter(), seed = Math.random(), fade = rand(.35, 1.1);
      for (let k = 0; k < samples.length - 1; k++) {
        const along = k / (samples.length - 1);
        const taper = Math.sin(Math.PI * along);
        filaments.push(samples[k]!, s, seed, fade * taper, 0, 0, along); filaments.push(samples[k + 1]!, s, seed, fade * taper, 0, 0, (k + 1) / (samples.length - 1));
      }
    }
    const mindMaterial = lineMaterial({ ...this.uniforms, uColor: { value: GOLD.clone() }, uHot: { value: WHITE.clone() } }, .3);
    this.disposables.push(mindMaterial);
    const mind = new LineSegments(filaments.geometry(), mindMaterial);
    this.disposables.push(mind.geometry);
    this.shell([.04, .11, -.03]).add(mind);

    // Sparks and glints: points on the shells and dust in the air, blurred the further they sit from focus.
    const sparks = new Builder();
    for (let i = 0, n = Math.round(2200 * density); i < n; i++) {
      const s = scatter(), seed = Math.random();
      if (i % 3) {
        const [cl, co] = clusters[i % clusters.length]!;
        sparks.push(onSphere(cl + rand(-.32, .32), co + rand(-.45, .45), layers[i % layers.length]! + rand(-.01, .01)), s, seed, rand(.3, 1));
      } else sparks.push(new Vector3().randomDirection().multiplyScalar(Math.pow(Math.random(), .5) * 1.6), s, seed, rand(.1, .6));
    }
    const sparkMaterial = new ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      vertexShader: COMMON + /* glsl */`varying float vSize, vBlur, vStar;
        void main(){ vec4 mv = modelViewMatrix * vec4(place(position), 1.); gl_Position = projectionMatrix * mv;
          float depth = -mv.z, blur = clamp(abs(depth - 4.6) * 1.6, 0., 1.);
          vStar = step(.985, aSeed);
          vSize = (aSeed > .97 ? 6. + aSeed * 4. : 1.4 + aSeed * 3.) * (1. + uLevel * .12) * (1. + blur * 1.1) * (1. + vStar * 1.4);
          vBlur = blur;
          vAlpha /= 1. + blur * 3.5;
          gl_PointSize = vSize * uPixel * (4.2 / depth); }`,
      fragmentShader: /* glsl */`uniform vec3 uColor, uHot; uniform float uTime; varying float vAlpha, vHeat, vSize, vBlur, vStar;
        void main(){
          vec2 c = gl_PointCoord - .5; float d = length(c);
          float a = smoothstep(.5, mix(0., .35, vBlur), d);
          float glint = vStar * (max(0., 1. - abs(c.x) * 26.) * max(0., 1. - abs(c.y) * 2.2) + max(0., 1. - abs(c.y) * 26.) * max(0., 1. - abs(c.x) * 2.2)) * (.6 + .4 * sin(uTime * 3. + vSize));
          gl_FragColor = vec4(mix(uColor, uHot, .45 + vHeat * .55) * (a * a + glint * 1.5) * vAlpha * .95, 1.); }`,
    });
    this.disposables.push(sparkMaterial);
    const sparkPoints = new Points(sparks.geometry(), sparkMaterial);
    this.disposables.push(sparkPoints.geometry);
    this.shell([0, -.03, .01]).add(sparkPoints);

    // Ribbons: long arcs of light sweeping round the sphere, the way the VisionQuest core trails fire.
    {
      const ribbonMaterial = lineMaterial(this.uniforms, .3);
      this.disposables.push(ribbonMaterial);
      const ribbons: [number, number, number, number, [number, number, number]][] = [[1.14, .9, 2.6, .2, [0, .16, .03]], [1.22, -.5, 2.2, 1.4, [.02, -.12, 0]], [1.3, .25, 1.8, 2.6, [-.05, .09, .04]], [1.08, -1.1, 2.9, 4.1, [.03, .2, -.02]]];
      for (const [radius, tilt, sweep, start, spin] of ribbons) {
        const b = new Builder(), s = new Vector3(), q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, .3).normalize(), tilt);
        const steps = low ? 70 : 140;
        for (let strand = 0; strand < 3; strand++) for (let i = 0; i < steps; i++) {
          const at = (k: number) => { const t = k / steps, a = start + t * sweep, r = radius + strand * .012 + Math.sin(t * 7 + strand) * .01; return new Vector3(Math.cos(a) * r, Math.sin(t * 3 + strand) * .02, Math.sin(a) * r).applyQuaternion(q); };
          const fade = Math.sin(Math.PI * i / steps) * (strand === 1 ? 1 : .55);
          b.push(at(i), scatter(), Math.random(), fade, 0, 0, i / steps); b.push(at(i + 1), scatter(), Math.random(), fade, 0, 0, (i + 1) / steps);
        }
        const line = new LineSegments(b.geometry(), ribbonMaterial);
        this.disposables.push(line.geometry);
        this.shell(spin).add(line);
      }
    }
    // A cool field of data dust behind and around him: the blue world VisionQuest sets the amber core against.
    {
      const count = low ? 260 : 620, positions = new Float32Array(count * 3), seeds = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const v = new Vector3().randomDirection().multiplyScalar(1.5 + Math.random() * 2.2);
        v.z -= 1.2;
        positions.set([v.x, v.y, v.z], i * 3); seeds[i] = Math.random();
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
      const dustMaterial = new ShaderMaterial({
        uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
        vertexShader: /* glsl */`uniform float uTime, uAssemble, uPixel, uThink; attribute float aSeed; varying float vA;
          void main(){ vec3 p = position; p.y += sin(uTime * .2 + aSeed * 40.) * .05; vec4 mv = modelViewMatrix * vec4(p, 1.);
            vA = uAssemble * (.35 + .65 * (.5 + .5 * sin(uTime * (1. + aSeed * 2.) + aSeed * 90.))) * (1. + uThink * .8);
            gl_PointSize = (1.8 + aSeed * 2.8) * uPixel * (3.6 / -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */`varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float a = exp(-dot(c, c) * 18.);
          gl_FragColor = vec4(vec3(.3, .7, 1.) * a * vA * .95, 1.); }`,
      });
      this.disposables.push(dustMaterial, geometry);
      const dust = new Points(geometry, dustMaterial);
      dust.renderOrder = -2;
      this.shell([0, .015, 0], this.scene as unknown as Group).add(dust);
    }

    // The core: a bright ring with a dark eye, a thin halo, and a soft glow behind.
    const core = new Builder();
    const torus = (radius: number, tube: number, count: number, fade: number) => {
      const s = new Vector3(), seed = .02;
      for (let k = 0; k < count; k++) for (let j = 0; j < 72; j++) {
        const a = j / 72 * Math.PI * 2, b = (j + 1) / 72 * Math.PI * 2, t = (k / count - .5) * tube;
        core.push(new Vector3(Math.cos(a) * (radius + t), Math.sin(a) * (radius + t), Math.sin(k * 1.7) * tube * .4), s, seed, fade);
        core.push(new Vector3(Math.cos(b) * (radius + t), Math.sin(b) * (radius + t), Math.sin(k * 1.7) * tube * .4), s, seed, fade);
      }
    };
    torus(.09, .026, 6, .95);
    torus(.14, .004, 2, .8);
    torus(.18, .002, 1, .45);
    {
      const s = new Vector3();
      for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 64; i++) {
        const at = (k: number) => { const t = k / 64, r = .03 + t * .3, a = arm * Math.PI * 2 / 3 + t * 7.2; return new Vector3(Math.cos(a) * r, Math.sin(a) * r, Math.sin(t * 9 + arm) * .004); };
        core.push(at(i), s, .02, 1.15 - i / 64 * .75); core.push(at(i + 1), s, .02, 1.15 - (i + 1) / 64 * .75);
      }
      for (const side of [-1, 1]) for (let i = 0; i < 30; i++) {
        const at = (k: number) => { const t = k / 30; return new Vector3(side * (.03 + Math.sin(t * 2.4) * .05 * t), -.09 - t * .34, Math.sin(t * 5) * .01); };
        core.push(at(i), s, .02, .9 * (1 - i / 30)); core.push(at(i + 1), s, .02, .9 * (1 - (i + 1) / 30));
      }
    }
    const coreMaterial = lineMaterial({ ...this.uniforms, uColor: { value: GOLD.clone() }, uHot: { value: WHITE.clone() } });
    this.disposables.push(coreMaterial);
    const coreLines = new LineSegments(core.geometry(), coreMaterial);
    this.disposables.push(coreLines.geometry);
    this.core.add(coreLines);
    this.scene.add(this.core);

    // Glow behind, and an anamorphic streak through the core, the way a lens catches a bright point.
    const quad = (w: number, h: number) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute([-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0], 3));
      g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      this.disposables.push(g);
      return g;
    };
    const glowMaterial = new ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */`uniform float uAssemble, uLevel, uThink, uImplode; uniform vec3 uColor; varying vec2 vUv;
        void main(){ float d = length(vUv - .5) * 2.; float halo = exp(-d * d * 5.) * .05 + exp(-d * d * 120.) * .1;
          gl_FragColor = vec4(uColor * halo * uAssemble * (.8 + uLevel * .4 + uThink * .3 + uImplode * 2.), 1.); }`,
    });
    this.disposables.push(glowMaterial);
    const glow = new Mesh(quad(1.6, 1.6), glowMaterial);
    glow.renderOrder = -1;
    this.scene.add(glow);
    const streakMaterial = new ShaderMaterial({
      uniforms: { ...this.uniforms, uFlare: { value: 0 } }, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */`uniform float uAssemble, uLevel, uFlare; varying vec2 vUv;
        void main(){ vec2 c = vUv - .5; float line = exp(-abs(c.y) * 90.) * exp(-abs(c.x) * 3.2);
          float core = exp(-dot(c * vec2(6., 40.), c * vec2(6., 40.)));
          line += exp(-abs(c.y) * 220.) * exp(-abs(c.x) * 1.4) * .6;
          gl_FragColor = vec4(vec3(1., .78, .45) * (line * .5 + core * .25) * uAssemble * (.5 + uLevel * .25 + uFlare * 1.8), 1.); }`,
    });
    this.disposables.push(streakMaterial);
    this.streak = new Mesh(quad(2.2, .16), streakMaterial);
    this.scene.add(this.streak);
  }

  /** Fragments fly in and lock into the sphere. `to` lets a download drive the build. */
  assemble(to = 1) { this.target.assemble = to; this.target.implode = 0; }
  /** Collapse into the core, or back into the orb if an origin is set. */
  implode() { this.target.implode = 1; }
  /** Where the corner orb is, in the canvas's own coordinates (-1..1): arrivals and departures go through it. */
  setOrigin(x: number, y: number) {
    const point = new Vector3(x, y, .5).unproject(this.camera);
    const dir = point.sub(this.camera.position).normalize();
    this.originWorld.copy(this.camera.position).addScaledVector(dir, this.camera.position.z * .92);
    this.uniforms.uFromOrigin.value = 1;
  }
  /** A brief flare of the core, for moments like a command landing. */
  pulse() { this.flare = 1; }
  setMode(mode: SphereMode) { this.mode = mode; }
  /** Bloom and brightness, so the sphere can sit quietly behind text. */
  setGain(gain: number) { this.uniforms.uGain.value = gain; }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.frame = requestAnimationFrame(tick);
      if (document.hidden) { this.last = now; return; }
      const dt = Math.min(.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.composer.render(dt);
    };
    this.frame = requestAnimationFrame(tick);
  }
  stop() { this.running = false; cancelAnimationFrame(this.frame); }

  private step(dt: number) {
    const u = this.uniforms;
    u.uTime.value += dt;
    const ease = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-rate * dt));
    u.uAssemble.value = ease(u.uAssemble.value, this.target.assemble, this.target.assemble > u.uAssemble.value ? 1.5 : 4);
    u.uImplode.value = ease(u.uImplode.value, this.target.implode, 5);
    const raw = this.mode === 'speaking' ? Math.min(1, this.level() * 1.6) : 0;
    u.uLevel.value = ease(u.uLevel.value, raw, raw > u.uLevel.value ? 22 : 7);
    u.uThink.value = ease(u.uThink.value, this.mode === 'thinking' ? 1 : 0, 6);
    u.uListen.value = ease(u.uListen.value, this.mode === 'listening' ? 1 : 0, 5);
    u.uFlow.value = ease(u.uFlow.value, 1 + u.uThink.value * 3 + u.uLevel.value * 1.5, 4);
    // The equaliser: the real spectrum while speaking, a slow breathing otherwise.
    const spectrum = this.mode === 'speaking' ? this.spectrum() : null, bands = u.uBands.value;
    for (let i = 0; i < BANDS; i++) {
      const target = spectrum ? Math.min(1, (spectrum[i] ?? 0) * 1.4) : this.mode === 'thinking' ? .2 + .25 * Math.abs(Math.sin(u.uTime.value * 6 + i * 1.3)) : .04 + .05 * Math.sin(u.uTime.value * 1.4 + i * .5) ** 2;
      bands[i] = ease(bands[i]!, target, target > bands[i]! ? 26 : 6);
    }
    // Thinking whirls every shell faster; listening slows them, as if holding its breath.
    const pace = 1 + u.uThink.value * 4.5 + u.uLevel.value * .8 - u.uListen.value * .5 + u.uImplode.value * 6;
    for (const { group, spin } of this.shells) {
      group.rotation.x += spin.x * dt * pace; group.rotation.y += spin.y * dt * pace; group.rotation.z += spin.z * dt * pace;
    }
    if (!this.drag) this.spin.multiplyScalar(Math.exp(-dt * 1.6));
    this.root.rotation.y += (this.spin.x + .035) * dt;
    this.root.rotation.x = Math.max(-.9, Math.min(1.2, this.root.rotation.x + this.spin.y * dt));
    this.flare = Math.max(0, this.flare - dt * 1.8);
    const pulse = 1 + u.uLevel.value * .16 + Math.sin(u.uTime.value * 2.2) * .02 + u.uThink.value * .06 * Math.sin(u.uTime.value * 16) + this.flare * .25;
    this.core.scale.setScalar(pulse * (1 - u.uImplode.value * .4));
    this.core.rotation.z += dt * (.25 + u.uThink.value * 3);
    // The core and streak follow the sphere to the orb when it leaves.
    this.root.updateMatrixWorld();
    u.uOrigin.value.copy(this.originWorld).applyMatrix4(this.root.matrixWorld.clone().invert());
    const away = u.uFromOrigin.value * u.uImplode.value;
    this.core.position.copy(this.originWorld).multiplyScalar(away);
    this.streak.position.copy(this.core.position);
    ((this.streak.material as ShaderMaterial).uniforms.uFlare!).value = this.flare;
    this.bloom.strength = 1.0 + u.uLevel.value * .12 + u.uImplode.value * 1.2 + this.flare * .6;
    this.projection.uniforms.uTime!.value = u.uTime.value;
    this.projection.uniforms.uFlicker!.value = 1 + u.uThink.value * 2;
    // Where the pointer meets the sphere, fragments brighten, as if JARVIS is following your gaze.
    if (this.pointer) {
      const ray = new Vector3(this.pointer.x, this.pointer.y, .5).unproject(this.camera).sub(this.camera.position).normalize();
      const o = this.camera.position, b = o.dot(ray), c = o.lengthSq() - 1.0, h = b * b - c;
      if (h > 0) {
        const hit = o.clone().addScaledVector(ray, -b - Math.sqrt(h));
        u.uGaze.value.copy(hit.applyQuaternion(this.root.quaternion.clone().invert())).normalize();
      } else u.uGaze.value.set(0, 0, 0);
    } else u.uGaze.value.set(0, 0, 0);
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.projection.uniforms.uAspect!.value = w / h;
    this.projection.uniforms.uHeight!.value = h;
    this.camera.position.z = w / h < 1 ? 4.6 / Math.max(.55, w / h) : 4.6;
    this.camera.updateProjectionMatrix();
  }
  private down = (event: PointerEvent) => { this.drag = { x: event.clientX, y: event.clientY }; };
  private move = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    if (!this.drag) return;
    this.spin.set((event.clientX - this.drag.x) * .06, (event.clientY - this.drag.y) * .04);
    this.drag = { x: event.clientX, y: event.clientY };
  };
  private leave = () => { this.pointer = null; };
  private up = () => { this.drag = null; };

  dispose() {
    this.stop();
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerleave', this.leave);
    window.removeEventListener('pointerup', this.up);
    this.disposables.forEach(item => item.dispose());
    this.composer.dispose();
    this.renderer.dispose();
  }
}
