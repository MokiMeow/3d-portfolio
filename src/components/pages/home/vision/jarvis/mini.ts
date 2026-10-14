/**
 * The small JARVIS orb that lives in the corner: a canvas-2D miniature of the big sphere, cheap
 * enough to run all the time. A gold globe of latitude and longitude lines with short circuit
 * traces, a ring at the core and a ticking outer ring. It brightens and spins when JARVIS is busy.
 */
export type MiniMode = 'idle' | 'open' | 'listening' | 'thinking' | 'speaking' | 'alert';

type Trace = { lat: number; lon: number; steps: [number, number][]; bright: boolean };

export class MiniOrb {
  private ctx: CanvasRenderingContext2D;
  private frame = 0;
  private t = Math.random() * 10;
  private last = 0;
  private spin = 0;
  private energy = 0;
  private traces: Trace[] = [];
  mode: MiniMode = 'idle';
  level: () => number = () => 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 46; i++) {
      const steps: [number, number][] = [];
      for (let k = 0, n = 2 + Math.floor(Math.random() * 3); k < n; k++) steps.push(k % 2 ? [0, (Math.random() - .5) * .5] : [(Math.random() - .5) * .9, 0]);
      this.traces.push({ lat: (Math.random() - .5) * 2.4, lon: Math.random() * Math.PI * 2, steps, bright: Math.random() < .3 });
    }
  }

  start() {
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick);
      const dt = Math.min(.05, (now - (this.last || now)) / 1000);
      this.last = now;
      if (document.hidden) return;
      this.draw(dt);
    };
    this.frame = requestAnimationFrame(tick);
  }
  stop() { cancelAnimationFrame(this.frame); }

  private draw(dt: number) {
    const c = this.canvas, ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = c.clientWidth;
    if (!size) return;
    if (c.width !== Math.round(size * dpr)) { c.width = c.height = Math.round(size * dpr); }
    const busy = this.mode === 'thinking' ? 1 : this.mode === 'speaking' || this.mode === 'listening' || this.mode === 'open' ? .55 : this.mode === 'alert' ? .8 : 0;
    this.energy += (busy - this.energy) * (1 - Math.exp(-dt * 5));
    const level = this.mode === 'speaking' ? Math.min(1, this.level() * 1.8) : 0;
    this.t += dt;
    this.spin += dt * (.35 + this.energy * 1.6);
    const w = c.width, R = w * .34, cx = w / 2, cy = w / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, w);

    // A dark lens behind the globe so it reads on bright places too.
    const lens = ctx.createRadialGradient(cx, cy, R * .2, cx, cy, w * .5);
    lens.addColorStop(0, `rgba(40,22,6,${.5 + this.energy * .2})`); lens.addColorStop(.75, 'rgba(18,10,4,.55)'); lens.addColorStop(1, 'rgba(10,6,2,0)');
    ctx.fillStyle = lens; ctx.beginPath(); ctx.arc(cx, cy, w * .5, 0, Math.PI * 2); ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    const tilt = .38 + Math.sin(this.t * .3) * .05;
    const project = (lat: number, lon: number, r = R) => {
      const x = Math.cos(lat) * Math.cos(lon + this.spin), z = Math.cos(lat) * Math.sin(lon + this.spin), y = Math.sin(lat);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return [cx + x * r, cy - y2 * r, z2] as const;
    };
    const glow = 1 + level * .9 + this.energy * .4;
    const stroke = (alpha: number, width: number, hot = false) => {
      ctx.strokeStyle = hot ? `rgba(255,214,140,${Math.min(1, alpha * glow)})` : `rgba(255,150,40,${Math.min(1, alpha * glow)})`;
      ctx.lineWidth = width * dpr;
    };
    // Latitude and longitude lines, the back half dimmer.
    const path = (points: (readonly [number, number, number])[], alpha: number, width: number) => {
      for (let i = 1; i < points.length; i++) {
        const [x1, y1, z1] = points[i - 1]!, [x2, y2] = points[i]!;
        stroke(alpha * (z1 > 0 ? 1 : .32), width);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    };
    for (let k = -2; k <= 2; k++) path(Array.from({ length: 49 }, (_, i) => project(k * .5, i / 48 * Math.PI * 2)), .32, .7);
    for (let k = 0; k < 6; k++) path(Array.from({ length: 33 }, (_, i) => project(-Math.PI / 2 + i / 32 * Math.PI, k / 6 * Math.PI)), .22, .6);
    // Circuit traces that flicker.
    for (const [i, trace] of this.traces.entries()) {
      let lat = trace.lat, lon = trace.lon;
      const points = [project(lat, lon, R * 1.02)];
      for (const [dlon, dlat] of trace.steps) { lon += dlon; lat += dlat; points.push(project(lat, lon, R * 1.02)); }
      const flicker = .5 + .5 * Math.sin(this.t * (1.5 + (i % 7) * .6 + this.energy * 6) + i);
      path(points, (trace.bright ? .9 : .4) * flicker, trace.bright ? 1.1 : .8);
    }
    // The core ring with its dark eye.
    const coreR = R * (.2 + level * .07 + Math.sin(this.t * 2.2) * .01);
    ctx.shadowColor = 'rgba(255,170,60,.9)'; ctx.shadowBlur = 10 * dpr * glow;
    stroke(.95, 2.2, true); ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.stroke();
    stroke(.5, .8, true); ctx.beginPath(); ctx.arc(cx, cy, coreR * 1.55, this.t * 1.5, this.t * 1.5 + Math.PI * 1.3); ctx.stroke();
    ctx.shadowBlur = 0;
    // Outer tick ring, turning the other way.
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2 - this.spin * .6, major = i % 5 === 0;
      const r1 = R * 1.22, r2 = R * (major ? 1.32 : 1.27);
      stroke(major ? .55 : .28, major ? 1 : .7);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
