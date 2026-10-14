import * as THREE from 'three';
/** One renderer and one demand-driven frame source per window. No layout reads in tick. */
export class WindowRenderer {
    readonly renderer: THREE.WebGLRenderer;
    readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    width = 1;
    height = 1;
    private frame = 0;
    private disposed = false;
    private visible = false;
    private last = 0;
    private awakeUntil = 0;
    private ratioCeiling = 1.5;
    private resize: ResizeObserver;
    private intersection: IntersectionObserver;
    constructor(readonly host: HTMLElement, compact: boolean, private tick: (dt: number, time: number) => boolean, resized: () => void) {
        const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: ratio < 1.5, powerPreference: 'low-power' });
        this.ratioCeiling = ratio;
        this.renderer.setPixelRatio(ratio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline-offset:-4px';
        host.appendChild(this.renderer.domElement);
        this.resize = new ResizeObserver(entries => {
            if (this.disposed)
                return;
            const box = entries[0]?.contentRect;
            if (!box || box.width < 1 || box.height < 1)
                return;
            this.width = box.width;
            this.height = box.height;
            this.renderer.setSize(this.width, this.height, false);
            resized();
            this.wake();
        });
        this.resize.observe(host);
        this.intersection = new IntersectionObserver(entries => {
            this.visible = entries[0]?.isIntersecting ?? false;
            this.resume();
        });
        this.intersection.observe(host);
        document.addEventListener('visibilitychange', this.resume);
        this.motion.addEventListener('change', this.resume);
    }
    private resume = (): void => {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.last = 0;
        if (!document.hidden && this.visible)
            this.wake();
    };
    setCompact(compact: boolean): void {
        // Keep the original context's antialias choice valid if the window changes size.
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5, this.ratioCeiling));
        this.renderer.setSize(this.width, this.height, false);
        this.wake();
    }
    get active(): boolean { return !this.disposed && this.visible && !document.hidden; }
    wake = (): void => {
        this.awakeUntil = performance.now() + 2000;
        if (!this.disposed && this.visible && !document.hidden && !this.frame)
            this.frame = requestAnimationFrame(this.draw);
    };
    private draw = (time: number): void => {
        this.frame = 0;
        if (this.disposed || document.hidden || !this.visible)
            return;
        const dt = this.last ? Math.min((time - this.last) / 1000, .05) : 1 / 60;
        this.last = time;
        const moving = this.tick(dt, time / 1000);
        if (moving)
            this.awakeUntil = time + 2000;
        if (moving || time < this.awakeUntil)
            this.frame = requestAnimationFrame(this.draw);
        else
            this.last = 0;
    };
    dispose(): void {
        this.disposed = true;
        cancelAnimationFrame(this.frame);
        this.resize.disconnect();
        this.intersection.disconnect();
        document.removeEventListener('visibilitychange', this.resume);
        this.motion.removeEventListener('change', this.resume);
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
    }
}
/** Shared resources are collected once; the PMREM environment belongs to the window. */
export function disposeTree(root: THREE.Object3D, environment?: THREE.Texture): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    root.traverse(node => {
        if (!(node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line))
            return;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            materials.add(material);
            for (const value of Object.values(material))
                if (value instanceof THREE.Texture && value !== environment)
                    textures.add(value);
            if (material instanceof THREE.ShaderMaterial)
                for (const uniform of Object.values(material.uniforms)) {
                    if (uniform.value instanceof THREE.Texture && uniform.value !== environment)
                        textures.add(uniform.value);
                }
        }
    });
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    root.removeFromParent();
}
